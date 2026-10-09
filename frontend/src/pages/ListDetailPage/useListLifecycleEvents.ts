import { useCallback } from "react";
import type { Dispatch, SetStateAction } from "react";
import { useTranslation } from "react-i18next";
import { useNavigate } from "react-router-dom";
import { fetchList } from "../../api/lists";
import { useListEvents } from "../../hooks/useListEvents";
import type { DetailList } from "./useListDetailData";

interface UseListLifecycleEventsOptions {
  currentUserId: string | undefined;
  listId: string;
  /** Called for `member:removed` events about other users. */
  onOtherMemberRemoved: () => void;
  setList: Dispatch<SetStateAction<DetailList | null>>;
  token: string;
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
  setList,
  token
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
  const handleListUpdated = useCallback(() => {
    void fetchList(token, listId)
      .then((result) => setList((currentList) => (currentList ? { ...currentList, ...result.list } : result.list)))
      .catch((error: unknown) => console.error("Failed to refresh the list.", error));
  }, [listId, setList, token]);
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

  useListEvents("member:removed", listId, handleMemberRemoved);
  useListEvents("list:deleted", listId, handleListDeleted);
  useListEvents("list:updated", listId, handleListUpdated);
}
