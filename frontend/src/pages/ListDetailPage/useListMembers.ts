import { useCallback, useRef, useState } from "react";
import { writeCachedResource } from "../../api/offlineStore";
import { createMembersCacheKey, fetchListMembers, revokeListMember, shareListWithMember } from "../../api/sharing";
import type { Member } from "../../types";
import type { ActiveList } from "./useActiveList";

interface LoadMembersOptions {
  isOwner?: boolean;
  throwOnError?: boolean;
}

interface UseListMembersOptions {
  active: ActiveList;
  listId: string;
  /** Receives load failures; the caller decides how they are shown. */
  reportError: (error: unknown) => void;
  token: string;
}

/**
 * The members of a list and the owner's sharing commands. Only owners see members; for everybody
 * else the list stays empty and nothing is requested.
 */
export function useListMembers({ active, listId, reportError, token }: UseListMembersOptions) {
  const [members, setMembers] = useState<Member[]>([]);
  const membersRef = useRef<Member[]>([]);
  const [isSharingLoading, setIsSharingLoading] = useState<boolean>(false);

  const replaceMembers = useCallback((nextMembers: Member[]): Member[] => {
    membersRef.current = nextMembers;
    setMembers(nextMembers);
    return nextMembers;
  }, []);

  /** Forgets the members (another list was opened, or the user is not the owner). */
  const clear = useCallback((): void => {
    replaceMembers([]);
  }, [replaceMembers]);

  const loadMembers = useCallback(
    async ({ isOwner = false, throwOnError = false }: LoadMembersOptions = {}): Promise<Member[]> => {
      if (!isOwner) {
        if (active.isMounted()) {
          replaceMembers([]);
          setIsSharingLoading(false);
        }

        return [];
      }

      if (active.isMounted()) {
        setIsSharingLoading(true);
      }

      try {
        const membersResult = await fetchListMembers(listId, token);
        const nextMembers = membersResult.members ?? [];

        if (active.isMounted() && active.isCurrent(listId)) {
          replaceMembers(nextMembers);
        }

        return nextMembers;
      } catch (loadError) {
        if (active.isMounted()) {
          reportError(loadError);
        }

        if (throwOnError) {
          throw loadError;
        }

        return [];
      } finally {
        if (active.isMounted()) {
          setIsSharingLoading(false);
        }
      }
    },
    [active, listId, replaceMembers, reportError, token]
  );

  /** Invites somebody by email. Resolves with the server's answer (or the queued marker). */
  const shareWithMember = useCallback(
    (email: string) => shareListWithMember(listId, token, { email }),
    [listId, token]
  );

  /** Removes a member on the server, then from the shown list and the offline cache. Throws on failure. */
  const revokeMember = useCallback(
    async (memberId: string): Promise<void> => {
      await revokeListMember(listId, memberId, token);

      const nextMembers = replaceMembers(membersRef.current.filter((member) => member.user_id !== memberId));

      await writeCachedResource(createMembersCacheKey(listId), { members: nextMembers });
    },
    [listId, replaceMembers, token]
  );

  return { clear, isSharingLoading, loadMembers, members, revokeMember, shareWithMember };
}
