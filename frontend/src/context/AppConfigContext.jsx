import { useEffect, useState } from "react";
import { fetchAppConfig } from "../api/config";
import { AppConfigContext, defaultAppConfig } from "./appConfigState";

export function AppConfigProvider({ children, loadConfig = fetchAppConfig }) {
  const [appConfig, setAppConfig] = useState(defaultAppConfig);

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

export function StaticAppConfigProvider({ children, registrationEnabled = true }) {
  return (
    <AppConfigContext.Provider value={{ registrationEnabled }}>
      {children}
    </AppConfigContext.Provider>
  );
}
