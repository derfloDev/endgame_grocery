import { useEffect, useState } from "react";
import type { ReactElement } from "react";
import { useTranslation } from "react-i18next";
import { Link, useNavigate, useParams } from "react-router-dom";
import logo from "../../assets/endgame_grocery_logo.png";
import { acceptInvite } from "../../api/sharing";
import { useAuth } from "../../context/AuthContext";
import styles from "../../styles/auth.module.css";

export default function InviteAcceptPage(): ReactElement {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { token } = useAuth();
  const { token: inviteToken = "" } = useParams();
  const [error, setError] = useState<string>("");

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

    async function submitInvite(): Promise<void> {
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

        setError(getErrorMessage(acceptError));
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
          {!error ? <p className="eg-success-banner">{t("invite.opening")}</p> : null}
          <div className="button-row">
            <Link className="eg-link" to="/login">
              {t("auth.backToLogin")}
            </Link>
          </div>
        </div>
      </section>
    </main>
  );
}

function getErrorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}
