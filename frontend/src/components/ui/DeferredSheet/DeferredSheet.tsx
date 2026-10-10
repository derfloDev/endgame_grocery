import { Suspense, useState } from "react";
import type { ReactElement, ReactNode } from "react";

interface DeferredSheetProps {
  /** Whether the sheet is open right now. */
  open: boolean;
  /** A (usually lazy) sheet element. It is not rendered, so its code is not fetched, until first opened. */
  children: ReactNode;
}

/**
 * Renders a lazily loaded sheet only from the moment it is first opened.
 *
 * Sheets are rarely used, so their code stays out of the startup bundle and out of the cold-load
 * transfer. After the first opening the sheet stays mounted (closed sheets render nothing), which
 * keeps its internal state behaviour identical to an always-mounted sheet. The chunk is part of the
 * service worker precache, so opening a sheet works offline too.
 */
export default function DeferredSheet({ open, children }: DeferredSheetProps): ReactElement | null {
  const [hasBeenOpened, setHasBeenOpened] = useState(open);

  if (open && !hasBeenOpened) {
    setHasBeenOpened(true);
  }

  if (!open && !hasBeenOpened) {
    return null;
  }

  return <Suspense fallback={null}>{children}</Suspense>;
}
