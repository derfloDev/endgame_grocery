import { useState } from "react";
import type { FormEvent, ReactElement } from "react";
import { useTranslation } from "react-i18next";
import { Link, Navigate, useLocation, useNavigate, useSearchParams } from "react-router-dom";
import logo from "../assets/endgame_grocery_logo.png";
import { useAuth } from "../context/AuthContext";
import { useAppConfig } from "../context/appConfigState";

interface LoginLocationState {
  from?: string;
  message?: string;
}

export default function LoginPage(): ReactElement {
  const { t } = useTranslation();
  const { login, token } = useAuth();
  const { registrationEnabled } = useAppConfig();
  const navigate = useNavigate();
  const location = useLocation();
  const [searchParams] = useSearchParams();
  const locationState = location.state as LoginLocationState | null;
  const [email, setEmail] = useState<string>("");
  const [password, setPassword] = useState<string>("");
  const [error, setError] = useState<string>("");
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);
  const redirectTo = searchParams.get("redirect") ?? locationState?.from ?? "/";
  const successMessage = locationState?.message ?? "";

  if (token) {
    return <Navigate to={redirectTo} replace />;
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>): Promise<void> {
    event.preventDefault();
    setError("");
    setIsSubmitting(true);

    try {
      await login({ email, password });
      navigate(redirectTo, { replace: true });
    } catch (submitError) {
      setError(getErrorMessage(submitError));
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
        <h1>{t("auth.welcomeBack")}</h1>
        <p>{t("auth.signIn")}</p>
        <form className="auth-form" onSubmit={handleSubmit}>
          {successMessage ? <p className="eg-success-banner">{successMessage}</p> : null}
          {error ? <p className="eg-error-banner">{error}</p> : null}
          <div className="eg-field">
            <label htmlFor="login-email">{t("auth.email")}</label>
            <input
              id="login-email"
              autoComplete="email"
              className="eg-input"
              name="email"
              required
              type="email"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
            />
          </div>
          <div className="eg-field">
            <label htmlFor="login-password">{t("auth.password")}</label>
            <input
              id="login-password"
              autoComplete="current-password"
              className="eg-input"
              name="password"
              required
              type="password"
              value={password}
              onChange={(event) => setPassword(event.target.value)}
            />
          </div>
          <div className="button-row">
            <button className="eg-btn-primary" disabled={isSubmitting} type="submit">
              {isSubmitting ? t("auth.signingIn") : t("auth.logIn")}
            </button>
            <Link className="eg-link" to="/forgot-password">
              {t("auth.forgotPassword")}
            </Link>
            {registrationEnabled ? (
              <Link className="eg-link" to="/register">
                {t("auth.createAccount")}
              </Link>
            ) : null}
          </div>
        </form>
      </section>
    </main>
  );
}

function getErrorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}
