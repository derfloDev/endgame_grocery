import { Navigate, Outlet, Route, Routes } from "react-router-dom";
import type { ReactElement } from "react";
import OfflineBanner from "./components/OfflineBanner/OfflineBanner";
import ProtectedRoute from "./components/ProtectedRoute/ProtectedRoute";
import ForgotPasswordPage from "./pages/ForgotPasswordPage";
import InviteAcceptPage from "./pages/InviteAcceptPage";
import ListDetailPage from "./pages/ListDetailPage";
import LoginPage from "./pages/LoginPage";
import OverviewPage from "./pages/OverviewPage";
import RegisterPage from "./pages/RegisterPage";
import ResetPasswordPage from "./pages/ResetPasswordPage";
import VerifyEmailPage from "./pages/VerifyEmailPage";
import { useAppConfig } from "./context/appConfigState";
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
      <div className="app-shell">
        <OfflineBanner />
        <Outlet />
      </div>
    </ProtectedRoute>
  );
}
