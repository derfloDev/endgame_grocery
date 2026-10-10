import { describe, it } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const repoRootDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");

function readRepoFile(relativePath) {
  return fs.readFileSync(path.join(repoRootDir, relativePath), "utf8").replace(/\r\n/g, "\n");
}

const nginxConf = readRepoFile("docker/nginx.conf");
const headersConf = readRepoFile("docker/security-headers.conf");

function headerValue(name) {
  const match = headersConf.match(new RegExp(`^add_header ${name} "([^"]+)" always;$`, "m"));
  assert.ok(match, `${name} must be added with "always"`);
  return match[1];
}

function cspDirectives() {
  return Object.fromEntries(
    headerValue("Content-Security-Policy")
      .split(";")
      .map((part) => part.trim().split(/\s+/))
      .map(([name, ...sources]) => [name, sources])
  );
}

describe("nginx security headers", () => {
  it("sends the hardening headers on every response", () => {
    assert.equal(headerValue("X-Content-Type-Options"), "nosniff");
    assert.equal(headerValue("Referrer-Policy"), "no-referrer");
    assert.equal(headerValue("Permissions-Policy"), "camera=(), microphone=(), geolocation=()");
  });

  it("uses the planned content security policy", () => {
    const csp = cspDirectives();

    assert.deepEqual(csp["default-src"], ["'self'"]);
    // blob: is required by the icon worker's runtime loader (evidence: README, CSP section).
    assert.deepEqual(csp["script-src"], ["'self'", "'wasm-unsafe-eval'", "blob:", "https://cdn.jsdelivr.net"]);
    assert.deepEqual(csp["worker-src"], ["'self'", "blob:"]);
    assert.deepEqual(csp["connect-src"], [
      "'self'",
      "https://huggingface.co",
      "https://*.hf.co",
      "https://cdn.jsdelivr.net"
    ]);
    assert.deepEqual(csp["img-src"], ["'self'", "data:", "blob:"]);
    assert.deepEqual(csp["style-src"], ["'self'", "'unsafe-inline'"]);
    assert.deepEqual(csp["font-src"], ["'self'"]);
    assert.deepEqual(csp["manifest-src"], ["'self'"]);
    assert.deepEqual(csp["object-src"], ["'none'"]);
    assert.deepEqual(csp["base-uri"], ["'self'"]);
    assert.deepEqual(csp["frame-ancestors"], ["'none'"]);
    assert.deepEqual(csp["form-action"], ["'self'"]);
  });

  it("never allows inline or string-evaluated scripts", () => {
    const scriptSources = cspDirectives()["script-src"];

    assert.ok(!scriptSources.includes("'unsafe-inline'"));
    assert.ok(!scriptSources.includes("'unsafe-eval'"));
    assert.ok(!scriptSources.includes("*"));
  });

  it("includes the headers at server level and in every location that sets its own headers", () => {
    const include = "include /etc/nginx/security-headers.conf;";
    const serverLevel = nginxConf.split(/\n {4}location /)[0];
    assert.ok(serverLevel.includes(include), "server level must include the security headers");

    const locations = nginxConf.split(/\n {4}location /).slice(1);
    assert.ok(locations.length >= 3);
    for (const location of locations) {
      if (/\badd_header\b/.test(location)) {
        assert.ok(location.includes(include), `location without security headers: ${location.split("\n")[0]}`);
      }
    }
  });

  it("copies the headers file to the path nginx includes", () => {
    assert.match(
      readRepoFile("Dockerfile"),
      /COPY docker\/security-headers\.conf \/etc\/nginx\/security-headers\.conf/
    );
  });
});

describe("container process user", () => {
  it("runs the backend as the unprivileged node user and nginx as root", () => {
    const supervisord = readRepoFile("docker/supervisord.conf");
    const backendSection = supervisord.split("[program:backend]")[1];
    const nginxSection = supervisord.split("[program:nginx]")[1].split("[program:backend]")[0];

    assert.match(backendSection, /^user=node$/m);
    assert.doesNotMatch(nginxSection, /^user=/m);
  });
});
