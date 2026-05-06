import { useState } from "react";
import { useTranslation } from "react-i18next";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import logo from "../assets/endgame_grocery_logo.png";
import { resetPassword } from "../api/auth";

export default function ResetPasswordPage() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const token = searchParams.get("token") ?? "";
  const [password, setPassword] = useState("");
  const [error, setError] = useState(token ? "" : t("auth.resetTokenRequired"));
  const [isSubmitting, setIsSubmitting] = useState(false);

  async function handleSubmit(event) {
    event.preventDefault();

    if (!token) {
      setError(t("auth.resetTokenRequired"));
      return;
    }

    setError("");
    setIsSubmitting(true);

    try {
      await resetPassword(token, password);
      navigate("/login", {
        replace: true,
        state: { message: t("auth.passwordUpdatedLogin") }
      });
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
        <h1>{t("auth.choosePassword")}</h1>
        <p>{t("auth.choosePasswordBody")}</p>
        <form className="auth-form" onSubmit={handleSubmit}>
          {error ? <p className="eg-error-banner">{error}</p> : null}
          <div className="eg-field">
            <label htmlFor="reset-password-next">{t("auth.newPassword")}</label>
            <input
              id="reset-password-next"
              autoComplete="new-password"
              className="eg-input"
              minLength={8}
              name="password"
              required
              type="password"
              value={password}
              onChange={(event) => setPassword(event.target.value)}
            />
          </div>
          <div className="button-row">
            <button className="eg-btn-primary" disabled={isSubmitting} type="submit">
              {isSubmitting ? t("auth.updating") : t("auth.updatePassword")}
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
