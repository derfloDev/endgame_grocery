import { useEffect, useState } from "react";
import type { ReactElement, ReactNode } from "react";
import { fetchAppConfig } from "../api/config";
import type { AppConfig } from "../types";
import { AppConfigContext, defaultAppConfig } from "./appConfigState";

interface AppConfigProviderProps {
  children: ReactNode;
  loadConfig?: () => Promise<AppConfig>;
}

interface StaticAppConfigProviderProps {
  children: ReactNode;
  registrationEnabled?: boolean;
}

export function AppConfigProvider({ children, loadConfig = fetchAppConfig }: AppConfigProviderProps): ReactElement {
  const [appConfig, setAppConfig] = useState<AppConfig>(defaultAppConfig);

  useEffect(() => {
    let isActive = true;

    loadConfig()
      .then((nextConfig) => {
        if (!isActive || !nextConfig || typeof nextConfig !== "object") {
          return;
        }

        setAppConfig({
          registrationEnabled:
            typeof nextConfig.registrationEnabled === "boolean"
              ? nextConfig.registrationEnabled
              : true
        });
      })
      .catch(() => {
        // Keep the fail-open default when the public config endpoint is unavailable.
      });

    return () => {
      isActive = false;
    };
  }, [loadConfig]);

  return <AppConfigContext.Provider value={appConfig}>{children}</AppConfigContext.Provider>;
}

export function StaticAppConfigProvider({
  children,
  registrationEnabled = true
}: StaticAppConfigProviderProps): ReactElement {
  return (
    <AppConfigContext.Provider value={{ registrationEnabled }}>
      {children}
    </AppConfigContext.Provider>
  );
}
