import { describe, it, expect } from "vitest";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { LobbyScene } from "./LobbyScene.jsx";

describe("LobbyScene", () => {
  const markup = renderToStaticMarkup(<LobbyScene />);

  it("is decorative: hidden from assistive technology", () => {
    expect(markup).toContain('aria-hidden="true"');
  });

  it("keeps the backdrop non-interactive and self-contained", () => {
    expect(markup).not.toMatch(/<(button|a|input|select|textarea|img)\b/i);
    // No remote assets: the scene is drawn with gradients and inline vectors.
    expect(markup).not.toMatch(/https?:\/\//);
    expect(markup).not.toMatch(/url\(/);
  });
});
