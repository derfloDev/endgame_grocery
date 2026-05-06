import "./i18n";
import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { BrowserRouter } from "react-router-dom";
import App from "./App";
import { AppConfigProvider } from "./context/AppConfigContext";
import { AuthProvider } from "./context/AuthContext";
import { EventSourceProvider } from "./context/EventSourceContext";
import { OfflineQueueProvider } from "./context/OfflineQueueContext";
import { registerServiceWorker } from "./sw/register";
import { primeIconWorker } from "./workers/iconWorkerClient";

registerServiceWorker();
primeIconWorker();

createRoot(document.getElementById("root")).render(
  <StrictMode>
    <BrowserRouter
      future={{
        v7_relativeSplatPath: true,
        v7_startTransition: true
      }}
    >
      <AppConfigProvider>
        <AuthProvider>
          <EventSourceProvider>
            <OfflineQueueProvider>
              <App />
            </OfflineQueueProvider>
          </EventSourceProvider>
        </AuthProvider>
      </AppConfigProvider>
    </BrowserRouter>
  </StrictMode>
);
