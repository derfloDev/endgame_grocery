import { useTranslation } from "react-i18next";
import { BottomSheet, LoadingState } from "./ui";

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
}) {
  const { t } = useTranslation();

  return (
    <BottomSheet open={open} title={t("share.title")} onClose={onClose}>
      <form className="share-list-form" onSubmit={onShareSubmit}>
        <label className="eg-field" htmlFor="share-list-sheet-email">
          <span className="share-list-label">{t("share.inviteLabel")}</span>
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
          {isSubmitting ? <span aria-hidden="true" className="share-invite-spinner" /> : null}
          {t("share.sendInvite")}
        </button>
      </form>

      {shareError || shareNotice ? (
        <div className="share-list-sheet-feedback">
          {shareError ? <div className="detail-banner eg-error-banner">{shareError}</div> : null}
          {shareNotice ? <div className="detail-banner eg-success-banner">{shareNotice}</div> : null}
        </div>
      ) : null}

      <div className="eg-orbitron share-sheet-members-label">{t("share.squadLabel")} ({members.length})</div>
      {isSharingLoading ? <LoadingState rows={2} /> : null}
      {!isSharingLoading
        ? members.map((member) => (
            <div key={member.user_id} className="member-row">
              <div className="member-row-copy">
                <div className="member-row-name">{member.display_name}</div>
                <div className="member-row-email">{member.email}</div>
              </div>
              <div className="member-row-actions">
                <span className={member.is_owner ? "eg-chip-purple" : "eg-chip-cyan"}>
                  {member.is_owner ? t("common.owner") : t("common.member")}
                </span>
                {member.is_pending_sync ? <span className="eg-chip-queued">{t("common.queued")}</span> : null}
                {!member.is_owner ? (
                  <button
                    className="eg-btn-danger member-row-revoke"
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
