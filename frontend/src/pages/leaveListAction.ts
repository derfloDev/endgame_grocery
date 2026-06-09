import { leaveList } from "../api/sharing";

interface LeaveSharedListOptions {
  confirmMessage: string;
  listId: string;
  token: string;
  onError: (error: unknown) => void;
  onSuccess: () => void | Promise<void>;
}

export async function leaveSharedList({
  confirmMessage,
  listId,
  token,
  onError,
  onSuccess
}: LeaveSharedListOptions): Promise<void> {
  if (!window.confirm(confirmMessage)) {
    return;
  }

  try {
    await leaveList(listId, token);
    await onSuccess();
  } catch (error) {
    onError(error);
  }
}
