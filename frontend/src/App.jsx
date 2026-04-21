import { Navigate, Outlet, Route, Routes } from "react-router-dom";
import OfflineBanner from "./components/OfflineBanner";
import ProtectedRoute from "./components/ProtectedRoute";
import { APP_TITLE } from "./app.constants";
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
      <main className="app-shell">
        <section className="hero-card">
          <p className="eyebrow">Shared household planning</p>
          <h1>{APP_TITLE}</h1>
          <OfflineBanner />
          <Outlet />
        </section>
      </main>
    </ProtectedRoute>
  );
}
