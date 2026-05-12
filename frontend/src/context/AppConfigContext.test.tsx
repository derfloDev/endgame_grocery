import { cleanup, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { AppConfigProvider } from "./AppConfigContext";
import { useAppConfig } from "./appConfigState";

function RegistrationState() {
  const { registrationEnabled } = useAppConfig();

  return <div>{registrationEnabled ? "enabled" : "disabled"}</div>;
}

describe("AppConfigProvider", () => {
  afterEach(() => {
    cleanup();
  });

  it("loads the public app config on mount", async () => {
    const loadConfig = vi.fn(async () => ({ registrationEnabled: false }));

    render(
      <AppConfigProvider loadConfig={loadConfig}>
        <RegistrationState />
      </AppConfigProvider>
    );

    expect(screen.getByText("enabled")).toBeTruthy();
    await waitFor(() => {
      expect(screen.getByText("disabled")).toBeTruthy();
    });
    expect(loadConfig).toHaveBeenCalledTimes(1);
  });

  it("keeps the fail-open default when loading config fails", async () => {
    const loadConfig = vi.fn(async () => {
      throw new Error("offline");
    });

    render(
      <AppConfigProvider loadConfig={loadConfig}>
        <RegistrationState />
      </AppConfigProvider>
    );

    expect(screen.getByText("enabled")).toBeTruthy();
    await waitFor(() => {
      expect(loadConfig).toHaveBeenCalledTimes(1);
    });
    expect(screen.getByText("enabled")).toBeTruthy();
  });
});
