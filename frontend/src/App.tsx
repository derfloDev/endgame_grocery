import { lazy, Suspense } from "react";
import { Navigate, Outlet, Route, Routes } from "react-router-dom";
import type { ReactElement } from "react";
import OfflineBanner from "./components/OfflineBanner/OfflineBanner";
import ProtectedRoute from "./components/ProtectedRoute/ProtectedRoute";
import UpdateBanner from "./components/UpdateBanner/UpdateBanner";
import ListDetailPage from "./pages/ListDetailPage/ListDetailPage";
import OverviewPage from "./pages/OverviewPage/OverviewPage";
import { useAppConfig } from "./context/appConfigState";
import styles from "./App.module.css";
import "./index.css";

// The overview and the list detail stay in the startup bundle: they are what an installed, signed-in
// user opens. Signed-out screens are rarely needed, so each one is fetched on demand. All chunks are
// part of the service worker precache, so they also work offline.
const ForgotPasswordPage = lazy(() => import("./pages/ForgotPasswordPage/ForgotPasswordPage"));
const InviteAcceptPage = lazy(() => import("./pages/InviteAcceptPage/InviteAcceptPage"));
const LoginPage = lazy(() => import("./pages/LoginPage/LoginPage"));
const RegisterPage = lazy(() => import("./pages/RegisterPage/RegisterPage"));
const ResetPasswordPage = lazy(() => import("./pages/ResetPasswordPage/ResetPasswordPage"));
const VerifyEmailPage = lazy(() => import("./pages/VerifyEmailPage/VerifyEmailPage"));


export default function App(): ReactElement {
  const { registrationEnabled } = useAppConfig();

  return (
    <Suspense fallback={null}>
      <Routes>
        <Route path="/login" element={<LoginPage />} />
        <Route
          path="/register"
          element={registrationEnabled ? <RegisterPage /> : <Navigate to="/login" replace />}
        />
        <Route path="/invite/:token" element={<InviteAcceptPage />} />
        <Route path="/verify-email" element={<VerifyEmailPage />} />
        <Route path="/forgot-password" element={<ForgotPasswordPage />} />
        <Route path="/reset-password" element={<ResetPasswordPage />} />
        <Route element={<ProtectedLayout />}>
          <Route path="/" element={<OverviewPage />} />
          <Route path="/lists/:id" element={<ListDetailPage />} />
        </Route>
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </Suspense>
  );
}

function ProtectedLayout(): ReactElement {
  return (
    <ProtectedRoute>
      <div className={styles["app-shell"]}>
        <UpdateBanner />
        <OfflineBanner />
        <Outlet />
      </div>
    </ProtectedRoute>
  );
}
