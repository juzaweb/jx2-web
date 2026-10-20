import React from "react";
import ReactDOM from "react-dom/client";
import "./index.css";
import "./styles/item-icons.css";
import { I18nProvider } from "./i18n/I18nProvider.jsx";
import { App } from "./App.jsx";

const rootElement = document.getElementById("root");
if (rootElement) {
  ReactDOM.createRoot(rootElement).render(
    <I18nProvider>
      <App />
    </I18nProvider>
  );
}
