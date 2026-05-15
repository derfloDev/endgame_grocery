import { describe, it } from "node:test";
import assert from "node:assert/strict";
import request from "supertest";
import { createApp } from "./app.js";

describe("API docs routes", () => {
  it("serves the Swagger UI", async () => {
    const response = await request(createApp({ pool: null })).get("/api/docs");

    assert.equal(response.status, 200);
    assert.match(response.headers["content-type"], /text\/html/);
    assert.match(response.text, /Swagger UI/i);
  });

  it("serves the OpenAPI YAML spec for the v1 API", async () => {
    const response = await request(createApp({ pool: null })).get("/api/docs/openapi.yaml");

    assert.equal(response.status, 200);
    assert.match(response.headers["content-type"], /application\/yaml/);
    assert.match(response.text, /openapi: 3\.1\.0/);
    assert.match(response.text, /ApiKeyAuth:/);
    assert.match(response.text, /name: X-Api-Key/);

    for (const path of [
      "/lists:",
      "/lists/{listId}/items:",
      "/lists/{listId}/items/{itemId}/toggle:",
      "/lists/{listId}/items/{itemId}:"
    ]) {
      assert.match(response.text, new RegExp(escapeRegExp(path)));
    }

    for (const responseCode of ["'401':", "'403':", "'404':"]) {
      assert.match(response.text, new RegExp(escapeRegExp(responseCode)));
    }
  });
});

function escapeRegExp(value) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}
