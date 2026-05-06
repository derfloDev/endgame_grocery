import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { Link, Navigate, useLocation, useNavigate, useSearchParams } from "react-router-dom";
import logo from "../assets/endgame_grocery_logo.png";
import { resendVerification, verifyEmail } from "../api/auth";
import { useAuth } from "../context/AuthContext";

export default function VerifyEmailPage() {
  const { t } = useTranslation();
  const { token, setAuthToken } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [searchParams] = useSearchParams();
  const verificationToken = searchParams.get("token");
  const [email, setEmail] = useState(location.state?.email ?? "");
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    if (!location.state?.email) {
      return;
    }

    setEmail(location.state.email);
  }, [location.state]);

  useEffect(() => {
    if (!verificationToken) {
      return;
    }

    let cancelled = false;

    async function submitVerification() {
      setError("");
      setNotice("");

      try {
        const result = await verifyEmail(verificationToken);

        if (cancelled) {
          return;
        }

        setAuthToken(result.token, result.user ?? null);
        navigate("/", { replace: true });
      } catch (verificationError) {
        if (cancelled) {
          return;
        }

        setError(verificationError.message);
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

  async function handleResend() {
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
      setError(resendError.message);
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <main className="auth-layout">
      <section className="auth-card">
        <div className="auth-brand">
          <img alt={t("app.brandName")} className="auth-logo" src={logo} />
          <div className="auth-brand-text">
            <div className="auth-brand-title eg-orbitron eg-gradient-text">{t("app.brandMain")}</div>
            <div className="auth-brand-sub">{t("app.brandSub")}</div>
          </div>
        </div>
        <h1>{verificationToken && !error ? t("auth.verifying") : t("auth.checkInbox")}</h1>
        <p>{t("auth.verifyBody")}</p>
        <div className="auth-form">
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
