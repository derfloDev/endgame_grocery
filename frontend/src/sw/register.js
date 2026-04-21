import { registerSW } from "virtual:pwa-register";

export function registerServiceWorker() {
  if (import.meta.env.DEV) {
    return;
  }

  registerSW({
    immediate: true
  });
}
