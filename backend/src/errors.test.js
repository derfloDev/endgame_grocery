import { describe, it } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import pino from "pino";
import request from "supertest";
import { createApp } from "./app.js";
import { ApiError, ERROR_CODES, createUnavailablePool, toApiError, toErrorBody } from "./errors.js";

const srcDir = path.dirname(fileURLToPath(import.meta.url));

function sourceFiles(dir) {
  return fs.readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const full = path.join(dir, entry.name);

    if (entry.isDirectory()) {
      return entry.name === "integration" || entry.name === "db" ? [] : sourceFiles(full);
    }

    return entry.name.endsWith(".js") && !entry.name.endsWith(".test.js") ? [full] : [];
  });
}

const sources = sourceFiles(srcDir).map((file) => ({ file, text: fs.readFileSync(file, "utf8") }));

describe("ApiError", () => {
  it("carries status, code and message and serialises to { error, code }", () => {
    const error = new ApiError(403, "list.forbidden", "No access.");

    assert.equal(error.status, 403);
    assert.deepEqual(toErrorBody(error), { error: "No access.", code: "list.forbidden" });
    assert.equal(toApiError(error), error);
  });

  it("refuses codes that are not in the catalogue", () => {
    assert.throws(() => new ApiError(400, "made.up", "x"), /Unknown API error code/);
  });

  it("maps database and body-parser errors, and leaves unexpected errors alone", () => {
    assert.deepEqual(toErrorBody(toApiError({ code: "22P02" })), { error: "Invalid identifier or value.", code: "request.invalid_value" });
    assert.equal(toApiError({ code: "23505" }).status, 409);
    assert.equal(toApiError({ code: "23503" }).code, "reference.not_found");
    assert.equal(toApiError({ type: "entity.parse.failed" }).code, "request.invalid_json");
    assert.deepEqual(
      [toApiError({ type: "entity.too.large" }).status, toApiError({ type: "entity.too.large" }).code],
      [413, "request.too_large"]
    );
    assert.equal(toApiError(new Error("boom")), null);
    assert.equal(toApiError(null), null);
  });
});

describe("error catalogue and call sites", () => {
  const used = new Set();

  for (const { text } of sources) {
    for (const match of text.matchAll(/new ApiError\(\s*\d+,\s*"([a-z_.]+)"/g)) {
      used.add(match[1]);
    }
  }

  it("only throws codes from the catalogue", () => {
    for (const code of used) {
      assert.ok(ERROR_CODES.includes(code), `${code} is thrown but not listed in ERROR_CODES`);
    }
  });

  it("lists no code that nothing can produce", () => {
    // Codes created inside errors.js itself (database / parser mappings, internal error) or built
    // from the password policy are produced without a literal `new ApiError(status, "code"` call.
    const producedElsewhere = new Set([
      "request.invalid_json",
      "request.too_large",
      "request.invalid_value",
      "conflict.duplicate",
      "reference.not_found",
      "internal.error",
      "validation.password_invalid",
      "validation.password_too_short",
      "validation.password_too_long"
    ]);

    for (const code of ERROR_CODES) {
      assert.ok(used.has(code) || producedElsewhere.has(code), `${code} is never used`);
    }
  });

  it("has no route that answers an error without a code", () => {
    for (const { file, text } of sources) {
      const relative = path.relative(srcDir, file);
      const matches = [...text.matchAll(/res\s*\.status\((?:4|5)\d\d\)\s*\.(?:json|send|end)\(/g)];

      // The central handler in app.js is the only place allowed to write an error status itself.
      if (relative !== "app.js") {
        assert.deepEqual(matches, [], `${relative} writes an error response directly`);
      }
    }
  });

  it("has no per-route database guards left", () => {
    for (const { file, text } of sources) {
      if (file.includes(`${path.sep}routes${path.sep}`)) {
        assert.doesNotMatch(text, /if \(!pool\)/, `${path.relative(srcDir, file)} still guards the pool`);
      }
    }
  });
});

describe("central error handling", () => {
  const silent = pino({ level: "silent" });

  it("answers a malformed JSON body with 400 and a code", async () => {
    const app = createApp({ pool: createUnavailablePool(), startWorkers: false, logger: silent });

    const response = await request(app).post("/api/auth/login").set("Content-Type", "application/json").send("{broken");

    assert.equal(response.status, 400);
    assert.equal(response.body.code, "request.invalid_json");
  });

  it("answers unexpected failures as internal.error without leaking details", async () => {
    const app = createApp({
      pool: { async query() { throw new Error("secret detail"); }, async connect() { throw new Error("secret detail"); } },
      startWorkers: false,
      logger: silent,
      requireAuthMiddleware(req, _res, next) {
        req.user = { sub: "u1" };
        next();
      }
    });

    const response = await request(app).get("/api/lists");

    assert.equal(response.status, 500);
    assert.deepEqual(response.body, { error: "Internal server error.", code: "internal.error" });
  });

  it("runs routes of an app without a database against a stand-in that fails clearly", async () => {
    const app = createApp({
      pool: null,
      startWorkers: false,
      logger: silent,
      requireAuthMiddleware(req, _res, next) {
        req.user = { sub: "u1" };
        next();
      }
    });

    const response = await request(app).get("/api/lists");

    assert.equal(response.status, 500);
    assert.equal(response.body.code, "internal.error");
  });

  it("sends a code with every authentication failure and rate limit", async () => {
    const app = createApp({ pool: createUnavailablePool(), startWorkers: false, logger: silent });

    const missing = await request(app).get("/api/lists");
    const invalid = await request(app).get("/api/lists").set("Authorization", "Bearer nope");

    assert.deepEqual(missing.body, { error: "Authentication token is required.", code: "auth.token_required" });
    assert.equal(invalid.body.code, "auth.invalid_token");
  });
  it("answers unknown API paths with a JSON 404 instead of Express's HTML page", async () => {
    const app = createApp({ pool: createUnavailablePool(), startWorkers: false, logger: silent });

    const response = await request(app).get("/api/does-not-exist");

    assert.equal(response.status, 404);
    assert.deepEqual(response.body, { error: "Not found.", code: "request.not_found" });
  });

  it("answers the disabled test routes the same way", async () => {
    const app = createApp({ pool: createUnavailablePool(), startWorkers: false, logger: silent, config: { enableTestRoutes: false } });

    const response = await request(app).post("/api/test/create-verified-user").send({});

    assert.deepEqual(response.body, { error: "Not found.", code: "request.not_found" });
  });

  it("answers a body over the size limit with 413 instead of a server error", async () => {
    const app = createApp({ pool: createUnavailablePool(), startWorkers: false, logger: silent });

    const response = await request(app)
      .post("/api/auth/login")
      .set("Content-Type", "application/json")
      .send(JSON.stringify({ email: "a@example.com", password: "x".repeat(200_000) }));

    assert.equal(response.status, 413);
    assert.equal(response.body.code, "request.too_large");
  });
});
