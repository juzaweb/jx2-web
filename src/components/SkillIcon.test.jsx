import { describe, it, expect } from "vitest";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { SkillIcon } from "./SkillIcon.jsx";

describe("SkillIcon", () => {
  it("renders the icon image when the catalog has an asset", () => {
    const markup = renderToStaticMarkup(
      <SkillIcon skill={{ icon: "/skills/la_han_quyen.png", glyph: "拳" }} className="slot-skill-icon" />
    );

    expect(markup).toContain('src="/skills/la_han_quyen.png"');
    expect(markup).toContain("slot-skill-icon");
    expect(markup).toContain("skill-icon-img");
  });

  it("renders the glyph when the skill has no icon asset", () => {
    const markup = renderToStaticMarkup(<SkillIcon skill={{ glyph: "拳" }} />);

    expect(markup).toContain("拳");
    expect(markup).not.toContain("<img");
  });
});
