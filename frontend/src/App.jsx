import { Navigate, Outlet, Route, Routes } from "react-router-dom";
import OfflineBanner from "./components/OfflineBanner";
import ProtectedRoute from "./components/ProtectedRoute";
import BottomNav from "./components/ui/BottomNav";
import ListDetailPage from "./pages/ListDetailPage";
import LoginPage from "./pages/LoginPage";
import OverviewPage from "./pages/OverviewPage";
import RegisterPage from "./pages/RegisterPage";
import "./index.css";

export default function App() {
  return (
    <Routes>
      <Route path="/login" element={<LoginPage />} />
      <Route path="/register" element={<RegisterPage />} />
      <Route element={<ProtectedLayout />}>
        <Route path="/" element={<OverviewPage />} />
        <Route path="/lists/:id" element={<ListDetailPage />} />
      </Route>
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}

function ProtectedLayout() {
  return (
    <ProtectedRoute>
      <div className="app-shell">
        <OfflineBanner />
        <Outlet />
        <BottomNav />
      </div>
    </ProtectedRoute>
  );
}
