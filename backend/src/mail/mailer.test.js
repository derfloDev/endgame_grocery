import { afterEach, describe, it } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { createMailer } from "./mailer.js";

const tempDirs = [];

afterEach(() => {
  while (tempDirs.length > 0) {
    fs.rmSync(tempDirs.pop(), { recursive: true, force: true });
  }
});

describe("createMailer", () => {
  it("creates an SMTP transport from config and renders a template before sending", async () => {
    const templatesDir = createTempTemplatesDir({
      "base.hbs": [
        "<!doctype html>",
        "<html>",
        "  <body>",
        "    <h1>{{heading}}</h1>",
        "    <p>{{body}}</p>",
        '    <a href="{{ctaUrl}}">{{ctaLabel}}</a>',
        "  </body>",
        "</html>",
        ""
      ].join("\n"),
      "welcome.hbs": "{{> base heading=heading body=body ctaUrl=ctaUrl ctaLabel=ctaLabel}}\n"
    });
    const sentMessages = [];
    const loggerEntries = [];
    let transportOptions;

    const mailer = createMailer({
      config: {
        smtpHost: "smtp.example.com",
        smtpPort: 465,
        smtpUser: "smtp-user",
        smtpPass: "smtp-pass",
        smtpFrom: "noreply@example.com",
        smtpFromName: "Endgame Grocery"
      },
      nodemailerLib: {
        createTransport(options) {
          transportOptions = options;
          return {
            async sendMail(message) {
              sentMessages.push(message);
              return { messageId: "message-1" };
            }
          };
        }
      },
      logger: createLoggerSpy(loggerEntries),
      templatesDir
    });

    const result = await mailer.send({
      to: "demo@example.com",
      subject: "Welcome",
      template: "welcome",
      context: {
        heading: "Welcome to Endgame Grocery",
        body: "Confirm your account to start sharing lists.",
        ctaUrl: "https://app.example.com/verify-email?token=abc123",
        ctaLabel: "Verify email"
      }
    });

    assert.deepEqual(transportOptions, {
      host: "smtp.example.com",
      port: 465,
      secure: true,
      auth: {
        user: "smtp-user",
        pass: "smtp-pass"
      }
    });
    assert.equal(result.messageId, "message-1");
    assert.equal(sentMessages.length, 1);
    assert.equal(sentMessages[0].to, "demo@example.com");
    assert.equal(sentMessages[0].subject, "Welcome");
    assert.equal(sentMessages[0].from, '"Endgame Grocery" <noreply@example.com>');
    assert.match(sentMessages[0].html, /Welcome to Endgame Grocery/);
    assert.match(sentMessages[0].html, /Confirm your account to start sharing lists\./);
    assert.match(
      sentMessages[0].html,
      /https:\/\/app\.example\.com\/verify-email\?token(?:=|&#x3D;)abc123/
    );
    assert.deepEqual(loggerEntries, [
      {
        level: "info",
        message: "Email sent",
        fields: {
          to: "demo@example.com",
          subject: "Welcome"
        }
      }
    ]);
  });

  it("skips sending and warns when smtpHost is not configured", async () => {
    let createTransportCalls = 0;
    const loggerEntries = [];
    const mailer = createMailer({
      config: {
        smtpHost: "",
        smtpPort: 587,
        smtpFrom: "noreply@example.com",
        smtpFromName: "Endgame Grocery"
      },
      nodemailerLib: {
        createTransport() {
          createTransportCalls += 1;
          return {
            async sendMail() {
              throw new Error("sendMail should not be called without SMTP config");
            }
          };
        }
      },
      logger: createLoggerSpy(loggerEntries)
    });

    const result = await mailer.send({
      to: "demo@example.com",
      subject: "Welcome",
      template: "welcome",
      context: {
        body: "Skipped delivery."
      }
    });

    assert.deepEqual(result, { skipped: true });
    assert.equal(createTransportCalls, 0);
    assert.deepEqual(loggerEntries, [
      {
        level: "warn",
        message: "SMTP host is not configured; skipping email delivery",
        fields: {}
      }
    ]);
  });

  it("logs and rethrows send errors", async () => {
    const loggerEntries = [];
    const templatesDir = createTempTemplatesDir({
      "base.hbs": "<body>{{body}}</body>\n",
      "welcome.hbs": "{{> base body=body}}\n"
    });
    const sendError = new Error("SMTP refused message");
    const mailer = createMailer({
      config: {
        smtpHost: "smtp.example.com",
        smtpPort: 587,
        smtpFrom: "noreply@example.com",
        smtpFromName: "Endgame Grocery"
      },
      nodemailerLib: {
        createTransport() {
          return {
            async sendMail() {
              throw sendError;
            }
          };
        }
      },
      logger: createLoggerSpy(loggerEntries),
      templatesDir
    });

    await assert.rejects(
      () =>
        mailer.send({
          to: "demo@example.com",
          subject: "Welcome",
          template: "welcome",
          context: {
            body: "This one fails."
          }
        }),
      sendError
    );

    assert.deepEqual(loggerEntries, [
      {
        level: "error",
        message: "Email send failed",
        fields: {
          err: sendError,
          to: "demo@example.com",
          subject: "Welcome"
        }
      }
    ]);
  });
});

function createTempTemplatesDir(templates) {
  const templatesDir = fs.mkdtempSync(path.join(process.cwd(), ".tmp-mailer-"));

  tempDirs.push(templatesDir);

  for (const [name, contents] of Object.entries(templates)) {
    fs.writeFileSync(path.join(templatesDir, name), contents);
  }

  return templatesDir;
}

function createLoggerSpy(entries) {
  return {
    info(fields, message) {
      entries.push({ level: "info", message, fields: fields ?? {} });
    },
    warn(fields, message) {
      entries.push({ level: "warn", message, fields: fields ?? {} });
    },
    error(fields, message) {
      entries.push({ level: "error", message, fields: fields ?? {} });
    }
  };
}
