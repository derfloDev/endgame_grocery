import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { BrowserRouter } from "react-router-dom";
import App from "./App";
import { AuthProvider } from "./context/AuthContext";
import { OfflineQueueProvider } from "./context/OfflineQueueContext";
import { registerServiceWorker } from "./sw/register";

registerServiceWorker();

createRoot(document.getElementById("root")).render(
  <StrictMode>
    <BrowserRouter
      future={{
        v7_relativeSplatPath: true,
        v7_startTransition: true
      }}
    >
      <AuthProvider>
        <OfflineQueueProvider>
          <App />
        </OfflineQueueProvider>
      </AuthProvider>
    </BrowserRouter>
  </StrictMode>
);
