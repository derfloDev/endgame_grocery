import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import Handlebars from "handlebars";
import nodemailer from "nodemailer";
import { getConfig } from "../env.js";

const moduleDir = path.dirname(fileURLToPath(import.meta.url));
const defaultTemplatesDir = path.join(moduleDir, "templates");

export function createMailer({
  config = getConfig(),
  nodemailerLib = nodemailer,
  handlebarsLib = Handlebars,
  templatesDir = defaultTemplatesDir
} = {}) {
  const transport = nodemailerLib.createTransport(createTransportOptions(config));
  const rendererPromise = createRenderer({ handlebarsLib, templatesDir });

  return {
    async send({ to, subject, template, context = {} }) {
      const renderer = await rendererPromise;
      const html = await renderer.render(template, {
        appName: config.smtpFromName || "Endgame Grocery",
        ...context
      });

      return transport.sendMail({
        from: formatFromAddress(config),
        to,
        subject,
        html
      });
    }
  };
}

async function createRenderer({ handlebarsLib, templatesDir }) {
  const handlebars = handlebarsLib.create();
  const baseTemplatePath = path.join(templatesDir, "base.hbs");
  const baseTemplate = await fs.readFile(baseTemplatePath, "utf8");

  handlebars.registerPartial("base", baseTemplate);

  return {
    async render(templateName, context) {
      const templatePath = path.join(templatesDir, `${templateName}.hbs`);
      const templateSource = await fs.readFile(templatePath, "utf8");
      const template = handlebars.compile(templateSource);

      return template(context);
    }
  };
}

function createTransportOptions(config) {
  const transport = {
    host: config.smtpHost,
    port: config.smtpPort,
    secure: config.smtpPort === 465
  };

  if (config.smtpUser || config.smtpPass) {
    transport.auth = {
      user: config.smtpUser,
      pass: config.smtpPass
    };
  }

  return transport;
}

function formatFromAddress(config) {
  if (!config.smtpFromName) {
    return config.smtpFrom;
  }

  return `"${config.smtpFromName}" <${config.smtpFrom}>`;
}

export default createMailer;
