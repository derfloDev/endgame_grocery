import { randomUUID } from "node:crypto";
import { expect, test } from "@playwright/test";
import pg from "pg";
import { getConfig } from "../backend/src/env.js";
import { hashToken } from "../backend/src/tokens.js";

async function createUser(request, displayName) {
  const email = `sharing-${randomUUID()}@e2e.test`;
  const response = await request.post("/api/test/create-verified-user", {
    data: { display_name: displayName, email, password: "password123" }
  });
  expect(response.status()).toBe(201);
  return { email, ...(await response.json()) };
}

async function createUserContext(browser, baseURL, token) {
  const context = await browser.newContext({ baseURL });
  await context.addInitScript((authToken) => {
    localStorage.setItem("endgame_grocery.auth_token", authToken);
    localStorage.setItem("i18nextLng", "en");
    // Observe the real stream's readiness; never replace its network connection or events.
    window.__sharingStreams = [];
    const NativeEventSource = window.EventSource;
    window.EventSource = class extends NativeEventSource {
      constructor(...args) {
        super(...args);
        window.__sharingStreams.push(this);
      }
    };
  }, token);
  return context;
}

async function openSharing(page) {
  await page.getByRole("button", { name: "List options", exact: true }).click();
  await page.getByRole("button", { name: /Share list/ }).click();
  return page.getByRole("dialog", { name: "Share List", exact: true });
}

test("owner shares, member accepts and receives live entries, then loses access on revoke", async ({ browser, request, baseURL }) => {
  const databaseUrl = getConfig().databaseUrl;
  expect(databaseUrl, "Sharing E2E requires DATABASE_URL for the local test database").toBeTruthy();
  const db = new pg.Client({ connectionString: databaseUrl });
  await db.connect();
  const contexts = [];
  const users = [];
  try {
    const owner = await createUser(request, "Sharing Owner");
    users.push(owner.email);
    const member = await createUser(request, "Sharing Member");
    users.push(member.email);
    const response = await request.post("/api/lists", {
      headers: { Authorization: `Bearer ${owner.token}` }, data: { name: "Shared Pantry" }
    });
    expect(response.status()).toBe(201);
    const { list } = await response.json();

    const ownerContext = await createUserContext(browser, baseURL, owner.token);
    contexts.push(ownerContext);
    const memberContext = await createUserContext(browser, baseURL, member.token);
    contexts.push(memberContext);
    const ownerPage = await ownerContext.newPage();
    const memberPage = await memberContext.newPage();
    await ownerPage.goto(`/lists/${list.id}`);
    const shareSheet = await openSharing(ownerPage);
    await shareSheet.getByLabel("Invite member by email").fill(member.email);
    const invitationResponse = ownerPage.waitForResponse((res) =>
      res.url().endsWith(`/api/lists/${list.id}/members`) && res.request().method() === "POST");
    await shareSheet.getByRole("button", { name: "Send Invite" }).click();
    const invitation = await invitationResponse;
    expect(invitation.status()).toBe(201);
    const { invite } = await invitation.json();
    await expect(shareSheet.getByText(`Invitation sent to ${member.email}.`)).toBeVisible();

    // CI has no SMTP inbox and only token hashes are persisted. Replace this test invite's
    // hash with a known random token; sharing and acceptance still use the real API and UI.
    const inviteToken = randomUUID();
    const seeded = await db.query(
      "UPDATE list_invites SET token_hash = $1 WHERE id = $2 AND list_id = $3 AND invited_email = $4 AND status = 'pending' RETURNING id",
      [hashToken(inviteToken), invite.id, list.id, member.email]
    );
    expect(seeded.rowCount).toBe(1);
    await memberPage.goto(`/invite/${inviteToken}`);
    await expect(memberPage).toHaveURL(`/lists/${list.id}`);
    await expect(memberPage.getByText("Shared Pantry", { exact: true })).toBeVisible();
    await memberPage.waitForFunction(() => window.__sharingStreams.some((source) => source.readyState === EventSource.OPEN));

    const memberNavigations = [];
    memberPage.on("request", (req) => {
      if (req.isNavigationRequest() && req.frame() === memberPage.mainFrame()) memberNavigations.push(req.url());
    });
    // The backdrop fills the viewport; its centre is covered by the sheet on desktop.
    await ownerPage.getByRole("button", { name: "Close sheet" }).click({ position: { x: 10, y: 10 } });
    await ownerPage.getByRole("button", { name: "Add", exact: true }).click();
    const addSheet = ownerPage.getByRole("dialog", { name: "Add Item", exact: true });
    await addSheet.getByRole("textbox", { name: "Add item", exact: true }).fill("Shared milk");
    await addSheet.getByRole("button", { name: "Add Item", exact: true }).click();
    await expect(ownerPage.getByText("Shared milk", { exact: true })).toBeVisible();
    await expect(memberPage.getByText("Shared milk", { exact: true })).toBeVisible();
    expect(memberNavigations).toEqual([]);

    await ownerPage.getByRole("button", { name: "Close sheet" }).click({ position: { x: 10, y: 10 } });
    const membersSheet = await openSharing(ownerPage);
    await expect(membersSheet.getByText(member.email, { exact: true })).toBeVisible();
    const revokeResponse = ownerPage.waitForResponse((res) =>
      res.url().includes(`/api/lists/${list.id}/members/`) && res.request().method() === "DELETE");
    await membersSheet.getByRole("button", { name: "Revoke", exact: true }).click();
    expect((await revokeResponse).status()).toBe(204);
    await expect(memberPage).toHaveURL("/");
    await expect(memberPage.getByText("You were removed from this list.")).toBeVisible();
    await expect(memberPage.getByText("Shared Pantry", { exact: true })).toHaveCount(0);
    expect(memberNavigations).toEqual([]);
    const denied = await request.get(`/api/lists/${list.id}/entries`, {
      headers: { Authorization: `Bearer ${member.token}` }
    });
    expect(denied.status()).toBe(403);
  } catch (error) {
    for (const [index, context] of contexts.entries()) {
      const page = context.pages()[0];
      if (page && !page.isClosed()) {
        await test.info().attach(`sharing-context-${index}`, {
          body: await page.locator("body").innerText(), contentType: "text/plain"
        });
      }
    }
    throw error;
  } finally {
    // Playwright may already have disposed a context on timeout; still clean up database rows.
    await Promise.allSettled(contexts.map((context) => context.close()));
    try {
      // User deletion cascades to this test's lists, invites, entries and memberships.
      await db.query("DELETE FROM users WHERE email = ANY($1::text[])", [users]);
    } finally {
      await db.end();
    }
  }
});
