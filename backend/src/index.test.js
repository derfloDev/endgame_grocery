import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { startServer } from "./index.js";

const backendSrcDir = path.dirname(fileURLToPath(import.meta.url));
const repoRootDir = path.resolve(backendSrcDir, "../..");
const packageJson = JSON.parse(readFileSync(path.join(repoRootDir, "package.json"), "utf8"));

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
          version: packageJson.version,
          dbConfigured: true,
          smtpConfigured: true,
          vapidConfigured: true,
          logLevel: "debug"
        },
        message: "Backend started"
      }
    ]);
  });

  it("prints the app version from the root package in the container entrypoint", () => {
    const entrypoint = readFileSync(path.join(repoRootDir, "docker", "entrypoint.sh"), "utf8");

    assert.match(entrypoint, /APP_VERSION=\$\(node -p /);
    assert.match(entrypoint, /\/app\/package\.json/);
    assert.match(entrypoint, /echo "Version: \$\{APP_VERSION\}"/);
  });
});
