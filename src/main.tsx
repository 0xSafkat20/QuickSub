import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import Root from "./Root";
import "./index.css";
import { I18nProvider } from './i18n';

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <I18nProvider><Root /></I18nProvider>
  </StrictMode>,
);
