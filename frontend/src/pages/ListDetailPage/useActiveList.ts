import { useEffect, useMemo, useRef } from "react";

export interface ActiveList {
  /** False after the owning component unmounted; late responses must not set state then. */
  isMounted: () => boolean;
  /** Whether `listId` is still the list on screen; a response for another list must be dropped. */
  isCurrent: (listId: string) => boolean;
}

/**
 * Lets asynchronous work ask whether its result is still wanted. Requests outlive renders: the user
 * may have opened another list, or left the page, before the response arrives.
 */
export function useActiveList(listId: string): ActiveList {
  const isMountedRef = useRef(false);
  const currentListIdRef = useRef(listId);
  currentListIdRef.current = listId;

  useEffect(() => {
    isMountedRef.current = true;

    return () => {
      isMountedRef.current = false;
    };
  }, []);

  return useMemo(
    () => ({
      isMounted: () => isMountedRef.current,
      isCurrent: (candidate: string) => currentListIdRef.current === candidate
    }),
    []
  );
}
