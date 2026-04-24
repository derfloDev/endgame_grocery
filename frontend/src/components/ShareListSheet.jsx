import { BottomSheet, LoadingState } from "./ui";

export default function ShareListSheet({
  open,
  onClose,
  members,
  shareEmail,
  shareError,
  isSharingLoading,
  onEmailChange,
  onShareSubmit,
  onRevoke
}) {
  return (
    <BottomSheet open={open} title="Share List" onClose={onClose}>
      <form className="share-list-form" onSubmit={onShareSubmit}>
        <label className="eg-field" htmlFor="share-list-sheet-email">
          <span className="share-list-label">Add member by email</span>
          <input
            id="share-list-sheet-email"
            className="eg-input"
            placeholder="alex@example.com"
            type="email"
            value={shareEmail}
            onChange={(event) => onEmailChange(event.target.value)}
          />
        </label>
        <button className="eg-btn-secondary" type="submit">
          Add Member
        </button>
      </form>

      {shareError ? <div className="detail-banner eg-error-banner">{shareError}</div> : null}

      <div className="eg-orbitron share-sheet-members-label">SQUAD ({members.length})</div>
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
                  {member.is_owner ? "Owner" : "Member"}
                </span>
                {member.is_pending_sync ? <span className="eg-chip-queued">Queued</span> : null}
                {!member.is_owner ? (
                  <button
                    className="eg-btn-danger member-row-revoke"
                    type="button"
                    onClick={() => void onRevoke(member.user_id)}
                  >
                    Revoke
                  </button>
                ) : null}
              </div>
            </div>
          ))
        : null}
    </BottomSheet>
  );
}
