import { useCallback } from "react";
import { useTranslation } from "react-i18next";
import { useNavigate } from "react-router-dom";
import { SSE_EVENTS } from "../../api/sseEvents";
import { useListEvents } from "../../hooks/useListEvents";

interface UseListLifecycleEventsOptions {
  currentUserId: string | undefined;
  listId: string;
  /** Called for `member:removed` events about other users. */
  onOtherMemberRemoved: () => void;
  /** Fetches the list's metadata again (a rename); the entries stay untouched. */
  refreshList: () => void;
}

/**
 * Reacts to events that change what the current user can see of the list itself.
 *
 * - `list:deleted`, or `member:removed` for the current user: the list is gone for them, so go back
 *   to the overview and explain why there (the notice travels in the router state).
 * - `list:updated`: somebody renamed the list; refresh only its metadata so the title changes in
 *   place while the entries stay untouched.
 * - `member:removed` for somebody else: let the caller refresh the member list.
 */
export function useListLifecycleEvents({
  currentUserId,
  listId,
  onOtherMemberRemoved,
  refreshList
}: UseListLifecycleEventsOptions): void {
  const { t } = useTranslation();
  const navigate = useNavigate();

  const leaveWithNotice = useCallback(
    (noticeKey: "detail.listDeleted" | "detail.removedFromList") => {
      navigate("/", { replace: true, state: { notice: t(noticeKey) } });
    },
    [navigate, t]
  );
  const handleListDeleted = useCallback(() => leaveWithNotice("detail.listDeleted"), [leaveWithNotice]);
  const handleMemberRemoved = useCallback(
    (data: Record<string, unknown>) => {
      if (currentUserId && data.userId === currentUserId) {
        leaveWithNotice("detail.removedFromList");
        return;
      }

      onOtherMemberRemoved();
    },
    [currentUserId, leaveWithNotice, onOtherMemberRemoved]
  );

  useListEvents(SSE_EVENTS.memberRemoved, listId, handleMemberRemoved);
  useListEvents(SSE_EVENTS.listDeleted, listId, handleListDeleted);
  useListEvents(SSE_EVENTS.listUpdated, listId, refreshList);
}
