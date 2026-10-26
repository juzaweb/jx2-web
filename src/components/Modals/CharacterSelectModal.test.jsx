import { describe, it, expect, vi, beforeEach } from "vitest";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { I18nProvider } from "../../i18n/I18nProvider.jsx";
import { apiClient } from "../../game/apiClient.js";
import { CharacterSelectModal } from "./CharacterSelectModal.jsx";

describe("CharacterSelectModal", () => {
  const dummyUser = { id: "user_test_1", username: "tieuvotruong" };

  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it("renders character select modal with title and account info", () => {
    const markup = renderToStaticMarkup(
      <I18nProvider>
        <CharacterSelectModal
          isOpen={true}
          user={dummyUser}
          onStart={() => {}}
          onLogout={() => {}}
        />
      </I18nProvider>
    );

    expect(markup).toContain("tieuvotruong");
    expect(markup).toContain("jx2-cs-box");
  });

  it("does not render when isOpen is false", () => {
    const markup = renderToStaticMarkup(
      <I18nProvider>
        <CharacterSelectModal
          isOpen={false}
          user={dummyUser}
          onStart={() => {}}
          onLogout={() => {}}
        />
      </I18nProvider>
    );

    expect(markup).toBe("");
  });
});

