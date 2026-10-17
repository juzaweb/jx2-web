import React from "react";
import ReactDOM from "react-dom/client";
import "./index.css";
import "./styles/item-icons.css";
import { App } from "./App.jsx";

const rootElement = document.getElementById("root");
if (rootElement) {
  ReactDOM.createRoot(rootElement).render(<App />);
}
