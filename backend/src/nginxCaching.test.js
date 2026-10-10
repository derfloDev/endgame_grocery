import { describe, it } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

// nginx is not available in the unit-test environment, so these tests read docker/nginx.conf as
// text and check the rules that matter for caching, compression and security headers.
const repoRootDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
const nginxConf = fs.readFileSync(path.join(repoRootDir, "docker/nginx.conf"), "utf8").replace(/\r\n/g, "\n");

/** Returns `{ matcher, body }` for every `location` block (no nesting is used in this file). */
function locations() {
  const found = [];
  const pattern = /^\s*location\s+([^{]+?)\s*\{([^}]*)\}/gm;

  for (const match of nginxConf.matchAll(pattern)) {
    found.push({ matcher: match[1].trim(), body: match[2] });
  }

  return found;
}

function location(matcher) {
  const block = locations().find((candidate) => candidate.matcher === matcher);
  assert.ok(block, `location ${matcher} is missing`);
  return block.body;
}

function cacheControl(body) {
  const headers = [...body.matchAll(/add_header\s+Cache-Control\s+"([^"]+)"/g)].map((match) => match[1]);
  assert.equal(headers.length, 1, "exactly one Cache-Control header per location");
  return headers[0];
}

describe("nginx caching rules", () => {
  it("serves hashed build assets as immutable for one year", () => {
    const body = location("^~ /assets/");

    assert.equal(cacheControl(body), "public, max-age=31536000, immutable");
  });

  it("never lets the browser reuse the service worker or the app shell without revalidating", () => {
    assert.equal(cacheControl(location("= /service-worker.js")), "no-cache");
    assert.equal(cacheControl(location("= /index.html")), "no-cache");
    // The SPA fallback hands out index.html for client-side routes.
    assert.equal(cacheControl(location("/")), "no-cache");
  });

  it("caches fonts, install icons and the manifest for one day, because their names are not hashed", () => {
    assert.equal(cacheControl(location("^~ /fonts/")), "public, max-age=86400");
    assert.equal(cacheControl(location("~ ^/icon-[0-9]+\\.png$")), "public, max-age=86400");
    assert.equal(cacheControl(location("= /manifest.webmanifest")), "public, max-age=86400");
  });

  it("has no catch-all extension rule that would make unhashed files immutable", () => {
    // The former `location ~* \.(js|css|png|...)$` also matched /service-worker.js and the fonts.
    for (const { matcher } of locations()) {
      assert.doesNotMatch(matcher, /\(js\|css/, `${matcher} would cache unhashed files for a year`);
    }
  });

  it("does not combine `expires` with an explicit Cache-Control header (that sends two)", () => {
    assert.doesNotMatch(nginxConf, /^\s*expires\s/m);
  });
});

describe("nginx compression", () => {
  it("compresses at level 5 and varies on Accept-Encoding", () => {
    assert.match(nginxConf, /^gzip_vary on;$/m);
    assert.match(nginxConf, /^gzip_comp_level 5;$/m);
  });

  it("compresses text, JSON, manifest and WASM types but not already compressed fonts", () => {
    const types = nginxConf.match(/^gzip_types\s+([^;]+);/m)?.[1].split(/\s+/) ?? [];

    for (const type of [
      "text/plain",
      "text/css",
      "application/javascript",
      "application/json",
      "application/manifest+json",
      "application/wasm",
      "image/svg+xml"
    ]) {
      assert.ok(types.includes(type), `${type} should be compressed`);
    }

    assert.ok(!types.some((type) => /font\/woff2?/.test(type)), "WOFF2 is already compressed");
  });
});

describe("nginx security headers", () => {
  it("includes the shared header file at server level", () => {
    const serverLevel = nginxConf.replace(/^\s*location[\s\S]*?\n {4}\}\n/gm, "");

    assert.match(serverLevel, /include \/etc\/nginx\/security-headers\.conf;/);
  });

  it("repeats the include in every location that sets its own headers (add_header is not inherited)", () => {
    const withHeaders = locations().filter(({ body }) => /add_header/.test(body));

    assert.ok(withHeaders.length >= 6, "the static locations set Cache-Control");

    for (const { matcher, body } of withHeaders) {
      assert.match(body, /include \/etc\/nginx\/security-headers\.conf;/, `${matcher} lacks the security headers`);
    }
  });

  it("leaves the API proxy without add_header so it keeps the server-level headers", () => {
    assert.doesNotMatch(location("/api/"), /add_header/);
  });
});
