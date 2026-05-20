import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, it } from "node:test";
import assert from "node:assert/strict";

const srcDir = import.meta.dirname;

const requiredJSDocTargets = [
  ["routes/auth.js", "createToken", "function"],
  ["routes/auth.js", "createAuthRouter", "function"],
  ["routes/auth.js", "addHours", "function"],
  ["routes/auth.js", "buildAppUrl", "function"],
  ["routes/auth.js", "isInviteEmailMatch", "function"],
  ["routes/auth.js", "serializeAuthUser", "function"],
  ["routes/auth.js", "sendVerificationEmail", "function"],
  ["routes/auth.js", "sendPasswordResetEmail", "function"],
  ["routes/entries.js", "createEntryRouter", "function"],
  ["routes/lists.js", "createListRouter", "function"],
  ["routes/sharing.js", "createSharingRouter", "function"],
  ["routes/sharing.js", "getOwnedList", "function"],
  ["routes/sharing.js", "addDays", "function"],
  ["routes/sharing.js", "buildAppUrl", "function"],
  ["routes/sharing.js", "sendInviteEmail", "function"],
  ["routes/sharing.js", "sendRevocationEmail", "function"],
  ["routes/history.js", "createHistoryRouter", "function"],
  ["routes/suggestions.js", "createSuggestionsRouter", "function"],
  ["routes/push.js", "createPushRouter", "function"],
  ["routes/v1.js", "createV1Router", "function"],
  ["inviteService.js", "getPendingInviteByToken", "function"],
  ["inviteService.js", "acceptInviteForUser", "function"],
  ["sseManager.js", "SseManager", "class"],
  ["sseManager.js", "add", "method"],
  ["sseManager.js", "remove", "method"],
  ["sseManager.js", "sendToUsers", "method"],
  ["sseManager.js", "broadcastToList", "method"]
];

function escapeRegex(value) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function getJSDocBefore(source, targetName, targetType) {
  const escapedName = escapeRegex(targetName);
  const targetPattern =
    targetType === "class"
      ? `export\\s+class\\s+${escapedName}\\b`
      : targetType === "method"
        ? `\\n\\s{2}(?:async\\s+)?${escapedName}\\s*\\(`
        : `(?:export\\s+)?(?:async\\s+)?function\\s+${escapedName}\\s*\\(`;
  const match = source.match(new RegExp(`(/\\*\\*[\\s\\S]*?\\*/)[\\s\\r\\n]*${targetPattern}`));

  return match?.[1] ?? "";
}

describe("backend JSDoc annotations", () => {
  it("documents planned backend functions with @param and @returns", () => {
    for (const [fileName, targetName, targetType] of requiredJSDocTargets) {
      const source = readFileSync(path.resolve(srcDir, fileName), "utf8");
      const jsdoc = getJSDocBefore(source, targetName, targetType);

      assert.ok(jsdoc, `${fileName} ${targetName} should have a JSDoc block`);
      if (targetType !== "class") {
        assert.match(jsdoc, /@param\b/, `${fileName} ${targetName} should document parameters`);
        assert.match(jsdoc, /@returns\b/, `${fileName} ${targetName} should document the return value`);
      }
    }
  });
});
