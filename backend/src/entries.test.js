import { describe, it } from "node:test";
import assert from "node:assert/strict";
import request from "supertest";
import { createApp } from "./app.js";

function createAuthedApp(pool) {
  return createApp({
    pool,
    requireAuthMiddleware(req, _res, next) {
      req.user = { sub: "user-1" };
      next();
    }
  });
}

describe("entry routes", () => {
  it("returns entries for accessible lists", async () => {
    let callCount = 0;
    const pool = {
      async query() {
        callCount += 1;

        if (callCount === 1) {
          return { rows: [{ id: "list-1" }] };
        }

        return {
          rows: [
            { id: "entry-1", list_id: "list-1", text: "Milk", status: "open" },
            { id: "entry-2", list_id: "list-1", text: "Bread", status: "done" }
          ]
        };
      }
    };

    const response = await request(createAuthedApp(pool)).get("/api/lists/list-1/entries");

    assert.equal(response.status, 200);
    assert.equal(response.body.entries.length, 2);
  });

  it("creates an entry for an accessible list", async () => {
    let callCount = 0;
    const pool = {
      async query() {
        callCount += 1;

        if (callCount === 1) {
          return { rows: [{ id: "list-1" }] };
        }

        return {
          rows: [{ id: "entry-1", list_id: "list-1", text: "Milk", status: "open" }]
        };
      }
    };

    const response = await request(createAuthedApp(pool)).post("/api/lists/list-1/entries").send({
      text: "Milk"
    });

    assert.equal(response.status, 201);
    assert.equal(response.body.entry.status, "open");
  });

  it("updates entry text and status", async () => {
    let callCount = 0;
    const pool = {
      async query() {
        callCount += 1;

        if (callCount === 1) {
          return { rows: [{ id: "list-1" }] };
        }

        return {
          rows: [{ id: "entry-1", list_id: "list-1", text: "Oat milk", status: "done" }]
        };
      }
    };

    const response = await request(createAuthedApp(pool))
      .patch("/api/lists/list-1/entries/entry-1")
      .send({
        text: "Oat milk",
        status: "done"
      });

    assert.equal(response.status, 200);
    assert.equal(response.body.entry.text, "Oat milk");
    assert.equal(response.body.entry.status, "done");
  });

  it("deletes an entry", async () => {
    let callCount = 0;
    const pool = {
      async query() {
        callCount += 1;

        if (callCount === 1) {
          return { rows: [{ id: "list-1" }] };
        }

        return { rows: [{ id: "entry-1" }] };
      }
    };

    const response = await request(createAuthedApp(pool)).delete("/api/lists/list-1/entries/entry-1");

    assert.equal(response.status, 204);
  });
});
