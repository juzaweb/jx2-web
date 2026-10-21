import { describe, it, expect } from "vitest";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { I18nProvider } from "../../i18n/I18nProvider.jsx";
import { SERVER_NAME } from "../../game/serverConfig.js";
import { LoginModal } from "./LoginModal.jsx";

const renderLogin = () =>
  renderToStaticMarkup(
    <I18nProvider>
      <LoginModal isOpen onLoginSuccess={() => {}} />
    </I18nProvider>
  );

describe("LoginModal server card", () => {
  it("shows the one fixed server name", () => {
    expect(renderLogin()).toContain(SERVER_NAME);
  });

  it("offers no server switcher", () => {
    const markup = renderLogin();
    expect(markup).not.toContain("jx2-btn-server-select");
    expect(markup).not.toContain("jx2-server-list");
  });
});
