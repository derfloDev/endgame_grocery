import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { startServer } from "./index.js";

describe("startServer", () => {
  it("logs backend startup details", () => {
    const infoEntries = [];
    let listenedPort = null;
    const app = {
      listen(port, callback) {
        listenedPort = port;
        callback();
        return { close() {} };
      }
    };
    const config = {
      port: 4100,
      databaseUrl: "postgres://db",
      smtpHost: "smtp.example.com",
      vapidPublicKey: "public-key",
      vapidPrivateKey: "private-key",
      logLevel: "debug"
    };

    startServer({
      app,
      config,
      logger: {
        info(fields, message) {
          infoEntries.push({ fields, message });
        }
      }
    });

    assert.equal(listenedPort, 4100);
    assert.deepEqual(infoEntries, [
      {
        fields: {
          port: 4100,
          dbConfigured: true,
          smtpConfigured: true,
          vapidConfigured: true,
          logLevel: "debug"
        },
        message: "Backend started"
      }
    ]);
  });
});
