import { describe, it } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const repoRootDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
const nginxConf = fs.readFileSync(path.join(repoRootDir, "docker/nginx.conf"), "utf8").replace(/\r\n/g, "\n");

function logFormat(name) {
  const match = nginxConf.match(new RegExp(`log_format ${name} '([^']+)';`));
  assert.ok(match, `log_format ${name} is missing`);
  return match[1];
}

describe("nginx access log", () => {
  it("logs without the query string or credential headers", () => {
    for (const name of ["main_noquery", "invite_masked"]) {
      const format = logFormat(name);

      assert.doesNotMatch(format, /\$request(?![_a-z])/, `${name} must not log the full request line`);
      assert.doesNotMatch(format, /\$request_uri|\$args|\$query_string|\$arg_/, `${name} must not log query strings`);
      assert.doesNotMatch(format, /\$http_authorization|\$http_x_api_key|\$http_cookie/, `${name} must not log credentials`);
    }
  });

  it("does not log the referer, which carries the query string of the page that made the request", () => {
    // Mail links open /reset-password?token=…, /verify-email?token=… and /invite/<token>, and
    // browsers send that full URL as Referer on every asset and API call made from those pages.
    for (const name of ["main_noquery", "invite_masked"]) {
      assert.doesNotMatch(logFormat(name), /\$http_refer+er/, `${name} must not log the referer`);
    }
  });

  it("only logs variables that cannot carry credentials", () => {
    const allowed = new Set([
      "remote_addr", "remote_user", "time_local", "request_method", "uri",
      "server_protocol", "status", "body_bytes_sent", "http_user_agent"
    ]);

    for (const name of ["main_noquery", "invite_masked"]) {
      for (const [, variable] of logFormat(name).matchAll(/\$([a-z_]+)/g)) {
        assert.ok(allowed.has(variable), `${name} logs $${variable}, which is not on the allowlist`);
      }
    }
  });

  it("logs the path without arguments for ordinary requests", () => {
    assert.match(logFormat("main_noquery"), /"\$request_method \$uri \$server_protocol"/);
  });

  it("masks invite tokens in the path", () => {
    assert.match(logFormat("invite_masked"), /\/invites\/:token/);
    assert.doesNotMatch(logFormat("invite_masked"), /\$uri/);
  });

  it("routes each request to exactly one of the two formats", () => {
    assert.match(nginxConf, /access_log \/dev\/stdout main_noquery if=\$log_plain_request;/);
    assert.match(nginxConf, /access_log \/dev\/stdout invite_masked if=\$log_invite_request;/);
    assert.match(nginxConf, /map \$uri \$log_invite_request \{\s*~\^\/\(api\/\)\?invites\?\/ 1;\s*default 0;/);
    assert.match(nginxConf, /map \$uri \$log_plain_request \{\s*~\^\/\(api\/\)\?invites\?\/ 0;\s*default 1;/);
  });

  it("does not use the default combined access log", () => {
    assert.doesNotMatch(nginxConf, /access_log [^;]*\b(combined|main)\b/);
  });
});
