import { useAuth } from "../context/AuthContext";

export default function OverviewPage() {
  const { logout, user } = useAuth();

  return (
    <div className="stack">
      <header className="overview-header">
        <div className="stack">
          <span className="pill">Authenticated session</span>
          <p>Your lists will appear here in T-004.</p>
          <p>Signed in as user ID: {user?.id ?? "unknown"}</p>
        </div>
        <button className="button-secondary" type="button" onClick={logout}>
          Log out
        </button>
      </header>
    </div>
  );
}
