import { createContext, useContext } from "react";

export const defaultAppConfig = {
  registrationEnabled: true
};

export const AppConfigContext = createContext(defaultAppConfig);

export function useAppConfig() {
  return useContext(AppConfigContext);
}
