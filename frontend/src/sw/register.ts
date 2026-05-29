import { useRegisterSW } from "virtual:pwa-register/react";

export interface ServiceWorkerUpdateState {
  dismissUpdate: () => void;
  needRefresh: boolean;
  updateServiceWorker: (reloadPage?: boolean) => Promise<void>;
}

export function useServiceWorkerUpdate(): ServiceWorkerUpdateState {
  const {
    needRefresh: [needRefresh, setNeedRefresh],
    updateServiceWorker
  } = useRegisterSW({
    immediate: true
  });

  return {
    dismissUpdate: () => setNeedRefresh(false),
    needRefresh: import.meta.env.DEV ? false : needRefresh,
    updateServiceWorker
  };
}
