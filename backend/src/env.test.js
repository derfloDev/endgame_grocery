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
    const previousSmtpPort = process.env.SMTP_PORT;
    const previousLogLevel = process.env.LOG_LEVEL;
    const previousRegistrationEnabled = process.env.REGISTRATION_ENABLED;

    delete process.env.PORT;
    delete process.env.SMTP_PORT;
    delete process.env.LOG_LEVEL;
    delete process.env.REGISTRATION_ENABLED;

    assert.equal(getConfig().port, 4000);
    assert.equal(getConfig().smtpPort, 587);
    assert.equal(getConfig().logLevel, "info");
    assert.equal(getConfig().registrationEnabled, true);

    if (previousPort) {
      process.env.PORT = previousPort;
    }

    if (previousSmtpPort) {
      process.env.SMTP_PORT = previousSmtpPort;
    }

    restoreEnvVar("LOG_LEVEL", previousLogLevel);
    restoreEnvVar("REGISTRATION_ENABLED", previousRegistrationEnabled);
  });

  it("disables registration only when REGISTRATION_ENABLED is false", () => {
    const previousRegistrationEnabled = process.env.REGISTRATION_ENABLED;

    process.env.REGISTRATION_ENABLED = "false";
    assert.equal(getConfig().registrationEnabled, false);

    process.env.REGISTRATION_ENABLED = "true";
    assert.equal(getConfig().registrationEnabled, true);

    restoreEnvVar("REGISTRATION_ENABLED", previousRegistrationEnabled);
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
    const previousSmtpHost = process.env.SMTP_HOST;
    const previousSmtpPort = process.env.SMTP_PORT;
    const previousSmtpUser = process.env.SMTP_USER;
    const previousSmtpPass = process.env.SMTP_PASS;
    const previousSmtpFrom = process.env.SMTP_FROM;
    const previousSmtpFromName = process.env.SMTP_FROM_NAME;
    const previousAppBaseUrl = process.env.APP_BASE_URL;
    const previousVapidPublicKey = process.env.VAPID_PUBLIC_KEY;
    const previousVapidPrivateKey = process.env.VAPID_PRIVATE_KEY;
    const previousVapidContact = process.env.VAPID_CONTACT;
    const previousLogLevel = process.env.LOG_LEVEL;

    fs.mkdirSync(fixtureBackendSrcDir, { recursive: true });
    fs.copyFileSync(path.join(backendSrcDir, "env.js"), fixtureEnvModulePath);
    fs.writeFileSync(
      path.join(fixtureRootDir, ".env"),
      [
        "DATABASE_URL=postgres://fixture-user:fixture-pass@localhost:5432/fixture_db",
        "JWT_SECRET=fixture-secret",
        "PORT=4567",
        "SMTP_HOST=smtp.fixture.local",
        "SMTP_PORT=2525",
        "SMTP_USER=fixture-user",
        "SMTP_PASS=fixture-pass",
        "SMTP_FROM=noreply@fixture.local",
        "SMTP_FROM_NAME=Fixture Mailer",
        "APP_BASE_URL=https://fixture.local",
        "VAPID_PUBLIC_KEY=fixture-public-key",
        "VAPID_PRIVATE_KEY=fixture-private-key",
        "VAPID_CONTACT=mailto:fixture@example.com",
        "LOG_LEVEL=debug",
        ""
      ].join("\n")
    );

    try {
      delete process.env.DATABASE_URL;
      delete process.env.JWT_SECRET;
      delete process.env.PORT;
      delete process.env.JWT_EXPIRES_IN;
      delete process.env.SMTP_HOST;
      delete process.env.SMTP_PORT;
      delete process.env.SMTP_USER;
      delete process.env.SMTP_PASS;
      delete process.env.SMTP_FROM;
      delete process.env.SMTP_FROM_NAME;
      delete process.env.APP_BASE_URL;
      delete process.env.VAPID_PUBLIC_KEY;
      delete process.env.VAPID_PRIVATE_KEY;
      delete process.env.VAPID_CONTACT;
      delete process.env.LOG_LEVEL;
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
      assert.equal(config.smtpHost, "smtp.fixture.local");
      assert.equal(config.smtpPort, 2525);
      assert.equal(config.smtpUser, "fixture-user");
      assert.equal(config.smtpPass, "fixture-pass");
      assert.equal(config.smtpFrom, "noreply@fixture.local");
      assert.equal(config.smtpFromName, "Fixture Mailer");
      assert.equal(config.appBaseUrl, "https://fixture.local");
      assert.equal(config.vapidPublicKey, "fixture-public-key");
      assert.equal(config.vapidPrivateKey, "fixture-private-key");
      assert.equal(config.vapidContact, "mailto:fixture@example.com");
      assert.equal(config.logLevel, "debug");
    } finally {
      process.chdir(previousCwd);
      restoreEnvVar("DATABASE_URL", previousDatabaseUrl);
      restoreEnvVar("JWT_SECRET", previousJwtSecret);
      restoreEnvVar("PORT", previousPort);
      restoreEnvVar("JWT_EXPIRES_IN", previousJwtExpiresIn);
      restoreEnvVar("SMTP_HOST", previousSmtpHost);
      restoreEnvVar("SMTP_PORT", previousSmtpPort);
      restoreEnvVar("SMTP_USER", previousSmtpUser);
      restoreEnvVar("SMTP_PASS", previousSmtpPass);
      restoreEnvVar("SMTP_FROM", previousSmtpFrom);
      restoreEnvVar("SMTP_FROM_NAME", previousSmtpFromName);
      restoreEnvVar("APP_BASE_URL", previousAppBaseUrl);
      restoreEnvVar("VAPID_PUBLIC_KEY", previousVapidPublicKey);
      restoreEnvVar("VAPID_PRIVATE_KEY", previousVapidPrivateKey);
      restoreEnvVar("VAPID_CONTACT", previousVapidContact);
      restoreEnvVar("LOG_LEVEL", previousLogLevel);
      fs.rmSync(fixtureRootDir, { recursive: true, force: true });
    }
  });

  it("does not load .env when the file is absent", async () => {
    const fixtureRootDir = fs.mkdtempSync(path.join(repoRootDir, ".tmp-env-fixture-"));
    const fixtureBackendDir = path.join(fixtureRootDir, "backend");
    const fixtureBackendSrcDir = path.join(fixtureBackendDir, "src");
    const fixtureEnvModulePath = path.join(fixtureBackendSrcDir, "env.js");
    const fixtureDotenvDir = path.join(fixtureRootDir, "node_modules", "dotenv");
    const previousCwd = process.cwd();
    const previousDatabaseUrl = process.env.DATABASE_URL;
    const previousJwtSecret = process.env.JWT_SECRET;
    const previousPort = process.env.PORT;
    const previousJwtExpiresIn = process.env.JWT_EXPIRES_IN;
    const previousSmtpHost = process.env.SMTP_HOST;
    const previousSmtpPort = process.env.SMTP_PORT;
    const previousSmtpUser = process.env.SMTP_USER;
    const previousSmtpPass = process.env.SMTP_PASS;
    const previousSmtpFrom = process.env.SMTP_FROM;
    const previousSmtpFromName = process.env.SMTP_FROM_NAME;
    const previousAppBaseUrl = process.env.APP_BASE_URL;
    const previousVapidPublicKey = process.env.VAPID_PUBLIC_KEY;
    const previousVapidPrivateKey = process.env.VAPID_PRIVATE_KEY;
    const previousVapidContact = process.env.VAPID_CONTACT;
    const previousLogLevel = process.env.LOG_LEVEL;

    fs.mkdirSync(fixtureBackendSrcDir, { recursive: true });
    fs.mkdirSync(fixtureDotenvDir, { recursive: true });
    fs.copyFileSync(path.join(backendSrcDir, "env.js"), fixtureEnvModulePath);
    fs.writeFileSync(
      path.join(fixtureDotenvDir, "package.json"),
      JSON.stringify({ name: "dotenv", main: "index.js" })
    );
    fs.writeFileSync(
      path.join(fixtureDotenvDir, "index.js"),
      [
        "const fs = require('node:fs');",
        "module.exports = {",
        "  config(options) {",
        "    if (!fs.existsSync(options.path)) {",
        "      throw new Error(`Attempted to load missing env file: ${options.path}`);",
        "    }",
        "    return { parsed: {} };",
        "  }",
        "};",
        ""
      ].join("\n")
    );

    try {
      delete process.env.DATABASE_URL;
      delete process.env.JWT_SECRET;
      delete process.env.PORT;
      delete process.env.JWT_EXPIRES_IN;
      delete process.env.SMTP_HOST;
      delete process.env.SMTP_PORT;
      delete process.env.SMTP_USER;
      delete process.env.SMTP_PASS;
      delete process.env.SMTP_FROM;
      delete process.env.SMTP_FROM_NAME;
      delete process.env.APP_BASE_URL;
      delete process.env.VAPID_PUBLIC_KEY;
      delete process.env.VAPID_PRIVATE_KEY;
      delete process.env.VAPID_CONTACT;
      delete process.env.LOG_LEVEL;
      process.chdir(fixtureBackendDir);

      const fixtureModuleUrl = new URL(
        `?test-case=${Date.now()}`,
        pathToFileURL(fixtureEnvModulePath)
      );
      const { getConfig: getFixtureConfig } = await import(fixtureModuleUrl.href);
      const config = getFixtureConfig();

      assert.equal(config.databaseUrl, "");
      assert.equal(config.jwtSecret, "");
      assert.equal(config.port, 4000);
      assert.equal(config.jwtExpiresIn, "7d");
      assert.equal(config.smtpHost, "");
      assert.equal(config.smtpPort, 587);
      assert.equal(config.smtpUser, "");
      assert.equal(config.smtpPass, "");
      assert.equal(config.smtpFrom, "");
      assert.equal(config.smtpFromName, "");
      assert.equal(config.appBaseUrl, "");
      assert.equal(config.vapidPublicKey, "");
      assert.equal(config.vapidPrivateKey, "");
      assert.equal(config.vapidContact, "");
      assert.equal(config.logLevel, "info");
    } finally {
      process.chdir(previousCwd);
      restoreEnvVar("DATABASE_URL", previousDatabaseUrl);
      restoreEnvVar("JWT_SECRET", previousJwtSecret);
      restoreEnvVar("PORT", previousPort);
      restoreEnvVar("JWT_EXPIRES_IN", previousJwtExpiresIn);
      restoreEnvVar("SMTP_HOST", previousSmtpHost);
      restoreEnvVar("SMTP_PORT", previousSmtpPort);
      restoreEnvVar("SMTP_USER", previousSmtpUser);
      restoreEnvVar("SMTP_PASS", previousSmtpPass);
      restoreEnvVar("SMTP_FROM", previousSmtpFrom);
      restoreEnvVar("SMTP_FROM_NAME", previousSmtpFromName);
      restoreEnvVar("APP_BASE_URL", previousAppBaseUrl);
      restoreEnvVar("VAPID_PUBLIC_KEY", previousVapidPublicKey);
      restoreEnvVar("VAPID_PRIVATE_KEY", previousVapidPrivateKey);
      restoreEnvVar("VAPID_CONTACT", previousVapidContact);
      restoreEnvVar("LOG_LEVEL", previousLogLevel);
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
