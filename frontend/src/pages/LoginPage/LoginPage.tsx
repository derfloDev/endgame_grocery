import { useEffect, useState } from "react";
import type { FormEvent, ReactElement } from "react";
import { useTranslation } from "react-i18next";
import { Link, Navigate, useLocation, useNavigate, useSearchParams } from "react-router-dom";
import logo from "../../assets/endgame_grocery_logo.png";
import { useAuth } from "../../context/AuthContext";
import { SESSION_EXPIRED_REDIRECT_KEY } from "../../context/authStorage";
import { useAppConfig } from "../../context/appConfigState";
import styles from "../../styles/auth.module.css";

interface LoginLocationState {
  from?: string;
  message?: string;
  sessionExpired?: boolean;
}

export default function LoginPage(): ReactElement {
  const { t } = useTranslation();
  const { login, token } = useAuth();
  const { registrationEnabled } = useAppConfig();
  const navigate = useNavigate();
  const location = useLocation();
  const [searchParams] = useSearchParams();
  const locationState = location.state as LoginLocationState | null;
  const [storedSessionExpiredState] = useState<LoginLocationState | null>(() => readSessionExpiredRedirect());
  const effectiveLocationState = locationState ?? storedSessionExpiredState;
  const [email, setEmail] = useState<string>("");
  const [password, setPassword] = useState<string>("");
  const [error, setError] = useState<string>("");
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);
  const redirectTo = searchParams.get("redirect") ?? effectiveLocationState?.from ?? "/";
  const successMessage = effectiveLocationState?.message ?? "";
  const sessionExpired = effectiveLocationState?.sessionExpired ?? false;

  useEffect(() => {
    if (storedSessionExpiredState?.sessionExpired) {
      window.sessionStorage.removeItem(SESSION_EXPIRED_REDIRECT_KEY);
    }
  }, [storedSessionExpiredState?.sessionExpired]);

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
    <main className={styles["auth-layout"]}>
      <section className={styles["auth-card"]}>
        <div className={styles["auth-brand"]}>
          <img alt={t("app.brandName")} className={styles["auth-logo"]} src={logo} />
          <div>
            <div className={`eg-orbitron eg-gradient-text ${styles["auth-brand-title"]}`}>{t("app.brandMain")}</div>
            <div className={styles["auth-brand-sub"]}>{t("app.brandSub")}</div>
          </div>
        </div>
        <h1>{t("auth.welcomeBack")}</h1>
        <p>{t("auth.signIn")}</p>
        <form className={styles["auth-form"]} onSubmit={handleSubmit}>
          {sessionExpired ? <p className="eg-success-banner">{t("auth.sessionExpired")}</p> : null}
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

function readSessionExpiredRedirect(): LoginLocationState | null {
  try {
    const storedState = JSON.parse(window.sessionStorage.getItem(SESSION_EXPIRED_REDIRECT_KEY) ?? "null") as unknown;

    if (!storedState || typeof storedState !== "object") {
      return null;
    }

    const redirectState = storedState as LoginLocationState;

    return typeof redirectState.from === "string" && redirectState.sessionExpired === true
      ? redirectState
      : null;
  } catch {
    return null;
  }
}
