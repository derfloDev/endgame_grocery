import { useState } from "react";
import { useTranslation } from "react-i18next";
import { Link } from "react-router-dom";
import logo from "../assets/endgame_grocery_logo.png";
import { forgotPassword } from "../api/auth";

export default function ForgotPasswordPage() {
  const { t } = useTranslation();
  const [email, setEmail] = useState("");
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  async function handleSubmit(event) {
    event.preventDefault();
    setError("");
    setNotice("");
    setIsSubmitting(true);

    try {
      await forgotPassword(email.trim());
      setNotice(t("auth.resetSuccess"));
    } catch (submitError) {
      setError(submitError.message);
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
        <h1>{t("auth.resetTitle")}</h1>
        <p>{t("auth.resetBody")}</p>
        <form className="auth-form" onSubmit={handleSubmit}>
          {notice ? <p className="eg-success-banner">{notice}</p> : null}
          {error ? <p className="eg-error-banner">{error}</p> : null}
          <div className="eg-field">
            <label htmlFor="forgot-password-email">{t("auth.email")}</label>
            <input
              id="forgot-password-email"
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
            <button className="eg-btn-primary" disabled={isSubmitting} type="submit">
              {isSubmitting ? t("auth.sending") : t("auth.sendReset")}
            </button>
            <Link className="eg-link" to="/login">
              {t("auth.backToLogin")}
            </Link>
          </div>
        </form>
      </section>
    </main>
  );
}
