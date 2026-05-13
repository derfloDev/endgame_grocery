import { useTranslation } from "react-i18next";
import type { FormEvent, ReactElement } from "react";
import type { Member } from "../../types";
import { BottomSheet, LoadingState } from "../ui";
import styles from "./ShareListSheet.module.css";

interface SharedListMember extends Member {
  user_id: string;
  display_name: string;
  email: string;
  is_owner?: boolean;
  is_pending_sync?: boolean;
}

interface ShareListSheetProps {
  open: boolean;
  onClose: () => void;
  members: SharedListMember[];
  shareEmail: string;
  shareError: string;
  shareNotice: string;
  isSubmitting: boolean;
  isSharingLoading: boolean;
  onEmailChange: (value: string) => void;
  onShareSubmit: (event: FormEvent<HTMLFormElement>) => void;
  onRevoke: (memberId: string) => Promise<void> | void;
}

export default function ShareListSheet({
  open,
  onClose,
  members,
  shareEmail,
  shareError,
  shareNotice,
  isSubmitting,
  isSharingLoading,
  onEmailChange,
  onShareSubmit,
  onRevoke
}: ShareListSheetProps): ReactElement {
  const { t } = useTranslation();

  return (
    <BottomSheet open={open} title={t("share.title")} onClose={onClose}>
      <form className={styles["share-list-form"]} onSubmit={onShareSubmit}>
        <label className="eg-field" htmlFor="share-list-sheet-email">
          <span className={styles["share-list-label"]}>{t("share.inviteLabel")}</span>
          <input
            id="share-list-sheet-email"
            className="eg-input"
            placeholder={t("share.invitePlaceholder")}
            type="email"
            value={shareEmail}
            onChange={(event) => onEmailChange(event.target.value)}
          />
        </label>
        <button className="eg-btn-secondary" disabled={isSubmitting} type="submit">
          {isSubmitting ? <span aria-hidden="true" className={styles["share-invite-spinner"]} data-testid="share-invite-spinner" /> : null}
          {t("share.sendInvite")}
        </button>
      </form>

      {shareError || shareNotice ? (
        <div className={styles["share-list-sheet-feedback"]} data-testid="share-list-sheet-feedback">
          {shareError ? <div className="detail-banner eg-error-banner">{shareError}</div> : null}
          {shareNotice ? <div className="detail-banner eg-success-banner">{shareNotice}</div> : null}
        </div>
      ) : null}

      <div className={`eg-orbitron ${styles["share-sheet-members-label"]}`}>{t("share.squadLabel")} ({members.length})</div>
      {isSharingLoading ? <LoadingState rows={2} /> : null}
      {!isSharingLoading
        ? members.map((member) => (
            <div key={member.user_id} className={styles["member-row"]}>
              <div className={styles["member-row-copy"]}>
                <div className={styles["member-row-name"]}>{member.display_name}</div>
                <div className={styles["member-row-email"]}>{member.email}</div>
              </div>
              <div className={styles["member-row-actions"]}>
                <span className={member.is_owner ? "eg-chip-purple" : "eg-chip-cyan"}>
                  {member.is_owner ? t("common.owner") : t("common.member")}
                </span>
                {member.is_pending_sync ? <span className="eg-chip-queued">{t("common.queued")}</span> : null}
                {!member.is_owner ? (
                  <button
                    className={`eg-btn-danger ${styles["member-row-revoke"]}`}
                    type="button"
                    onClick={() => void onRevoke(member.user_id)}
                  >
                    {t("share.revoke")}
                  </button>
                ) : null}
              </div>
            </div>
          ))
        : null}
    </BottomSheet>
  );
}
