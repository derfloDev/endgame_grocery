import { useEffect, useRef, useState } from "react";
import type { ReactElement } from "react";
import { useTranslation } from "react-i18next";
import { Link, useNavigate, useParams } from "react-router-dom";
import logo from "../../assets/endgame_grocery_logo.png";
import { ApiError, getErrorMessage } from "../../api/errors";
import { acceptInvite } from "../../api/sharing";
import { useAuth } from "../../context/AuthContext";
import styles from "../../styles/auth.module.css";

export default function InviteAcceptPage(): ReactElement {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { token, user, logout } = useAuth();
  const { token: inviteToken = "" } = useParams();
  const [error, setError] = useState<string>("");
  const [wrongAccount, setWrongAccount] = useState(false);
  const acceptanceRef = useRef<{
    inviteToken: string;
    authToken: string;
    promise: ReturnType<typeof acceptInvite>;
  } | null>(null);

  useEffect(() => {
    if (!inviteToken) {
      setError(t("invite.invalidLink"));
      return;
    }

    if (!token) {
      navigate(`/login?redirect=${encodeURIComponent(`/invite/${inviteToken}`)}`, { replace: true });
      return;
    }

    let cancelled = false;
    // Accepting consumes the token. Reuse this page's request when StrictMode or a language
    // change replays the effect; a different invite or signed-in session gets its own request.
    if (acceptanceRef.current?.inviteToken !== inviteToken || acceptanceRef.current.authToken !== token) {
      acceptanceRef.current = { inviteToken, authToken: token, promise: acceptInvite(inviteToken, token) };
    }
    const acceptance = acceptanceRef.current.promise;

    async function submitInvite(): Promise<void> {
      setError("");
      setWrongAccount(false);

      try {
        const result = await acceptance;

        if (cancelled) {
          return;
        }

        navigate(`/lists/${result.listId}`, { replace: true });
      } catch (acceptError) {
        if (cancelled) {
          return;
        }

        if (acceptError instanceof ApiError && acceptError.code === "invite.email_mismatch") {
          // The invite belongs to another email address: offer to switch accounts.
          setWrongAccount(true);
          setError(t("invite.wrongAccount"));
          return;
        }


        setError(getErrorMessage(acceptError, t));
      }
    }

    void submitInvite();

    return () => {
      cancelled = true;
    };
  }, [inviteToken, navigate, t, token]);

  return (
    <main className={styles["auth-layout"]}>
      <section className={styles["auth-card"]}>
        <div className={styles["auth-brand"]}>
          <img alt={t("app.brandName")} className={styles["auth-logo"]} src={logo} />
          <div>
            <div className={`eg-orbitron eg-gradient-text ${styles["auth-brand-title"]}`}>{t("app.brandMain")}</div>
            <div className={styles["auth-brand-sub"]}>{t("app.brandSub")}</div>
          </div>
        </div>
        <h1>{error ? t("invite.unavailable") : t("invite.joining")}</h1>
        <p>
          {error
            ? t("invite.unavailableMsg")
            : t("invite.connecting")}
        </p>
        <div className={styles["auth-form"]}>
          {error ? <p className="eg-error-banner">{error}</p> : null}
          {wrongAccount && user?.email ? (
            <p>{t("invite.signedInAs", { email: user.email })}</p>
          ) : null}
          {!error ? <p className="eg-success-banner">{t("invite.opening")}</p> : null}
          <div className="button-row">
            {wrongAccount ? (
              <button className="eg-btn-secondary" type="button" onClick={logout}>
                {t("invite.switchAccount")}
              </button>
            ) : null}
            <Link className="eg-link" to="/login">
              {t("auth.backToLogin")}
            </Link>
          </div>
        </div>
      </section>
    </main>
  );
}

