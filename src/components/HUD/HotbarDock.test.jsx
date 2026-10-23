import { describe, it, expect, vi } from "vitest";
import React from "react";
import { HotbarDock } from "./HotbarDock.jsx";

describe("HotbarDock logic & props", () => {
  it("can be instantiated/rendered without exploding", () => {
    const element = <HotbarDock skills={[]} skillLoadout={{ u: 0, i: 1, o: 2, p: 3 }} />;
    expect(element).toBeDefined();
    expect(element.type).toBe(HotbarDock);
  });

  it("passes onRotateScreen prop correctly", () => {
    const handleRotate = vi.fn();
    const element = <HotbarDock onRotateScreen={handleRotate} />;
    expect(element.props.onRotateScreen).toBe(handleRotate);
  });
});
