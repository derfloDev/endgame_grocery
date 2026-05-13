import { useEffect, useState } from "react";
import type { ReactElement } from "react";
import { useTranslation } from "react-i18next";
import { Link, Navigate, useLocation, useNavigate, useSearchParams } from "react-router-dom";
import logo from "../../assets/endgame_grocery_logo.png";
import { resendVerification, verifyEmail } from "../../api/auth";
import { useAuth } from "../../context/AuthContext";
import styles from "../../styles/auth.module.css";

interface VerifyEmailLocationState {
  email?: string;
}

export default function VerifyEmailPage(): ReactElement {
  const { t } = useTranslation();
  const { token, setAuthToken } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [searchParams] = useSearchParams();
  const locationState = location.state as VerifyEmailLocationState | null;
  const verificationToken = searchParams.get("token");
  const [email, setEmail] = useState<string>(locationState?.email ?? "");
  const [error, setError] = useState<string>("");
  const [notice, setNotice] = useState<string>("");
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);

  useEffect(() => {
    if (!locationState?.email) {
      return;
    }

    setEmail(locationState.email);
  }, [locationState]);

  useEffect(() => {
    if (!verificationToken) {
      return;
    }

    let cancelled = false;
    const tokenToVerify = verificationToken;

    async function submitVerification(): Promise<void> {
      setError("");
      setNotice("");

      try {
        const result = await verifyEmail(tokenToVerify);

        if (cancelled) {
          return;
        }

        setAuthToken(result.token, result.user ?? null);
        navigate("/", { replace: true });
      } catch (verificationError) {
        if (cancelled) {
          return;
        }

        setError(getErrorMessage(verificationError));
      }
    }

    void submitVerification();

    return () => {
      cancelled = true;
    };
  }, [navigate, setAuthToken, verificationToken]);

  if (token && !verificationToken) {
    return <Navigate to="/" replace />;
  }

  async function handleResend(): Promise<void> {
    if (!email.trim()) {
      setError(t("auth.emailRequired"));
      setNotice("");
      return;
    }

    setError("");
    setNotice("");
    setIsSubmitting(true);

    try {
      await resendVerification(email.trim());
      setNotice(t("auth.verifySuccess"));
    } catch (resendError) {
      setError(getErrorMessage(resendError));
    } finally {
      setIsSubmitting(false);
    }
  }

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
        <h1>{verificationToken && !error ? t("auth.verifying") : t("auth.checkInbox")}</h1>
        <p>{t("auth.verifyBody")}</p>
        <div className={styles["auth-form"]}>
          {error ? <p className="eg-error-banner">{error}</p> : null}
          {notice ? <p className="eg-success-banner">{notice}</p> : null}
          <div className="eg-field">
            <label htmlFor="verify-email-address">{t("auth.email")}</label>
            <input
              id="verify-email-address"
              autoComplete="email"
              className="eg-input"
              name="email"
              required
              type="email"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
            />
          </div>
          <div className="button-row">
            <button
              className="eg-btn-primary"
              disabled={isSubmitting}
              type="button"
              onClick={handleResend}
            >
              {isSubmitting ? t("auth.sending") : t("auth.resendVerify")}
            </button>
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
