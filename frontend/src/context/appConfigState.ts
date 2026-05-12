import { createContext, useContext } from "react";
import type { AppConfig } from "../types";

export const defaultAppConfig: AppConfig = {
  registrationEnabled: true
};

export const AppConfigContext = createContext<AppConfig>(defaultAppConfig);

export function useAppConfig(): AppConfig {
  return useContext(AppConfigContext);
}
