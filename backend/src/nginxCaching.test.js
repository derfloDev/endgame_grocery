import { describe, it } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

// Unit tests inspect configuration text for scope, caching, compression and security headers.
// The image build and docker/smoke-nginx.sh validate the complete installed nginx configuration.
const repoRootDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
const nginxConf = fs.readFileSync(path.join(repoRootDir, "docker/nginx.conf"), "utf8").replace(/\r\n/g, "\n");

// Extract the server with balanced braces so nested locations remain inside its scope.
function serverScopes() {
  const start = nginxConf.search(/^server\s*\{/m);
  assert.ok(start >= 0, "server block is missing");
  const opening = nginxConf.indexOf("{", start);
  let depth = 1;
  let end = opening + 1;
  for (; end < nginxConf.length && depth > 0; end++) {
    if (nginxConf[end] === "{") depth++;
    if (nginxConf[end] === "}") depth--;
  }
  assert.equal(depth, 0, "server block must close");
  return { server: nginxConf.slice(opening + 1, end - 1), http: nginxConf.slice(0, start) + nginxConf.slice(end) };
}

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
  it("keeps all application gzip settings in server scope and HTTP-only rules outside it", () => {
    const { server, http } = serverScopes();
    for (const directive of ["gzip", "gzip_vary", "gzip_comp_level", "gzip_types"]) {
      const pattern = new RegExp(`^\\s*${directive}\\s+[^;]+;`, "gm");
      assert.equal([...server.matchAll(pattern)].length, 1, `${directive} must occur once inside server`);
      assert.doesNotMatch(http, pattern, `${directive} must not redefine Alpine HTTP defaults`);
    }
    assert.match(server, /^\s*gzip on;$/m);
    assert.doesNotMatch(server, /^\s*(map|log_format)\s/m);
    assert.match(http, /^map\s/m);
    assert.match(http, /^log_format\s/m);
  });

  it("compresses at level 5 and varies on Accept-Encoding", () => {
    assert.match(serverScopes().server, /^\s*gzip_vary on;$/m);
    assert.match(serverScopes().server, /^\s*gzip_comp_level 5;$/m);
  });

  it("compresses text, JSON, manifest and WASM types but not already compressed fonts", () => {
    const types = serverScopes().server.match(/^\s*gzip_types\s+([^;]+);/m)?.[1].split(/\s+/) ?? [];

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
