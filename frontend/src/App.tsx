import { Navigate, Outlet, Route, Routes } from "react-router-dom";
import type { ReactElement } from "react";
import OfflineBanner from "./components/OfflineBanner/OfflineBanner";
import ProtectedRoute from "./components/ProtectedRoute/ProtectedRoute";
import UpdateBanner from "./components/UpdateBanner/UpdateBanner";
import ForgotPasswordPage from "./pages/ForgotPasswordPage/ForgotPasswordPage";
import InviteAcceptPage from "./pages/InviteAcceptPage/InviteAcceptPage";
import ListDetailPage from "./pages/ListDetailPage/ListDetailPage";
import LoginPage from "./pages/LoginPage/LoginPage";
import OverviewPage from "./pages/OverviewPage/OverviewPage";
import RegisterPage from "./pages/RegisterPage/RegisterPage";
import ResetPasswordPage from "./pages/ResetPasswordPage/ResetPasswordPage";
import VerifyEmailPage from "./pages/VerifyEmailPage/VerifyEmailPage";
import { useAppConfig } from "./context/appConfigState";
import styles from "./App.module.css";
import "./index.css";

export default function App(): ReactElement {
  const { registrationEnabled } = useAppConfig();

  return (
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
