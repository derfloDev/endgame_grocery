import { describe, it } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { getConfig } from "./env.js";

const testFilePath = fileURLToPath(import.meta.url);
const backendSrcDir = path.dirname(testFilePath);
const repoRootDir = path.resolve(backendSrcDir, "../..");

describe("getConfig", () => {
  it("falls back to the default port", () => {
    const previousPort = process.env.PORT;

    delete process.env.PORT;

    assert.equal(getConfig().port, 4000);

    if (previousPort) {
      process.env.PORT = previousPort;
    }
  });

  it("loads DATABASE_URL from the project root .env regardless of cwd", async () => {
    const fixtureRootDir = fs.mkdtempSync(path.join(repoRootDir, ".tmp-env-fixture-"));
    const fixtureBackendDir = path.join(fixtureRootDir, "backend");
    const fixtureBackendSrcDir = path.join(fixtureBackendDir, "src");
    const fixtureEnvModulePath = path.join(fixtureBackendSrcDir, "env.js");
    const previousCwd = process.cwd();
    const previousDatabaseUrl = process.env.DATABASE_URL;
    const previousJwtSecret = process.env.JWT_SECRET;
    const previousPort = process.env.PORT;
    const previousJwtExpiresIn = process.env.JWT_EXPIRES_IN;

    fs.mkdirSync(fixtureBackendSrcDir, { recursive: true });
    fs.copyFileSync(path.join(backendSrcDir, "env.js"), fixtureEnvModulePath);
    fs.writeFileSync(
      path.join(fixtureRootDir, ".env"),
      [
        "DATABASE_URL=postgres://fixture-user:fixture-pass@localhost:5432/fixture_db",
        "JWT_SECRET=fixture-secret",
        "PORT=4567",
        ""
      ].join("\n")
    );

    try {
      delete process.env.DATABASE_URL;
      delete process.env.JWT_SECRET;
      delete process.env.PORT;
      delete process.env.JWT_EXPIRES_IN;
      process.chdir(fixtureBackendDir);

      const fixtureModuleUrl = new URL(
        `?test-case=${Date.now()}`,
        pathToFileURL(fixtureEnvModulePath)
      );
      const { getConfig: getFixtureConfig } = await import(fixtureModuleUrl.href);
      const config = getFixtureConfig();

      assert.equal(
        config.databaseUrl,
        "postgres://fixture-user:fixture-pass@localhost:5432/fixture_db"
      );
      assert.equal(config.jwtSecret, "fixture-secret");
      assert.equal(config.port, 4567);
    } finally {
      process.chdir(previousCwd);
      restoreEnvVar("DATABASE_URL", previousDatabaseUrl);
      restoreEnvVar("JWT_SECRET", previousJwtSecret);
      restoreEnvVar("PORT", previousPort);
      restoreEnvVar("JWT_EXPIRES_IN", previousJwtExpiresIn);
      fs.rmSync(fixtureRootDir, { recursive: true, force: true });
    }
  });
});

function restoreEnvVar(name, value) {
  if (value === undefined) {
    delete process.env[name];
    return;
  }

  process.env[name] = value;
}
