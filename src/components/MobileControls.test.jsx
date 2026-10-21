import { describe, it, expect, vi } from "vitest";
import React from "react";
import { MobileControls } from "./MobileControls.jsx";

describe("MobileControls logic & props", () => {
  it("can be instantiated/rendered without exploding", () => {
    const element = <MobileControls skills={[]} skillLoadout={{ u: 0, i: 1, o: 2, p: 3 }} />;
    expect(element).toBeDefined();
    expect(element.type).toBe(MobileControls);
  });

  it("passes correct props structure for skills and callbacks", () => {
    const onMove = vi.fn();
    const onAttack = vi.fn();
    const onSkill = vi.fn();
    const onCastKey = vi.fn();
    const onUseItem = vi.fn();

    const element = (
      <MobileControls
        onMove={onMove}
        onAttack={onAttack}
        onSkill={onSkill}
        onCastKey={onCastKey}
        onUseItem={onUseItem}
        skills={[{ slot: 0, id: "test_skill" }]}
      />
    );

    expect(element.props.onMove).toBe(onMove);
    expect(element.props.onAttack).toBe(onAttack);
    expect(element.props.onCastKey).toBe(onCastKey);
    expect(element.props.onUseItem).toBe(onUseItem);
  });
});
