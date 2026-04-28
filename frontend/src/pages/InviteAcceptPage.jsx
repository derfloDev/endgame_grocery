import { useEffect, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import logo from "../assets/endgame_grocery_logo.png";
import { acceptInvite } from "../api/sharing";
import { useAuth } from "../context/AuthContext";

export default function InviteAcceptPage() {
  const navigate = useNavigate();
  const { token } = useAuth();
  const { token: inviteToken = "" } = useParams();
  const [error, setError] = useState("");

  useEffect(() => {
    if (!inviteToken) {
      setError("Invitation link is invalid or has expired.");
      return;
    }

    if (!token) {
      navigate(`/login?redirect=${encodeURIComponent(`/invite/${inviteToken}`)}`, { replace: true });
      return;
    }

    let cancelled = false;

    async function submitInvite() {
      setError("");

      try {
        const result = await acceptInvite(inviteToken, token);

        if (cancelled) {
          return;
        }

        navigate(`/lists/${result.listId}`, { replace: true });
      } catch (acceptError) {
        if (cancelled) {
          return;
        }

        setError(acceptError.message);
      }
    }

    void submitInvite();

    return () => {
      cancelled = true;
    };
  }, [inviteToken, navigate, token]);

  return (
    <main className="auth-layout">
      <section className="auth-card">
        <div className="auth-brand">
          <img alt="Endgame Grocery" className="auth-logo" src={logo} />
          <div className="auth-brand-text">
            <div className="auth-brand-title eg-orbitron eg-gradient-text">ENDGAME</div>
            <div className="auth-brand-sub">GROCERY</div>
          </div>
        </div>
        <h1>{error ? "Invite unavailable" : "Joining shared list"}</h1>
        <p>
          {error
            ? "This invite can no longer be used. Ask the list owner to send a fresh one."
            : "We are connecting this invite to your account now."}
        </p>
        <div className="auth-form">
          {error ? <p className="eg-error-banner">{error}</p> : null}
          {!error ? <p className="eg-success-banner">Opening your shared list...</p> : null}
          <div className="button-row">
            <Link className="eg-link" to="/login">
              Back to login
            </Link>
          </div>
        </div>
      </section>
    </main>
  );
}
