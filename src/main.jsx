import React from "react";
import ReactDOM from "react-dom/client";
import "./index.css";
import "./styles/item-icons.css";
import { I18nProvider } from "./i18n/I18nProvider.jsx";
import { App } from "./App.jsx";
import { StorageManager } from "./game/storage.js";

// One-off migration: wipe local bags saved with the removed demo catalog before
// any component reads them.
StorageManager.purgeLegacyInventory();

const rootElement = document.getElementById("root");
if (rootElement) {
  ReactDOM.createRoot(rootElement).render(
    <I18nProvider>
      <App />
    </I18nProvider>
  );
}
