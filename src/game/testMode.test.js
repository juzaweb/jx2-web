import { afterEach, describe, expect, it, vi } from "vitest";
import { isTestMode } from "./testMode.js";

afterEach(() => {
  vi.unstubAllEnvs();
});

describe("isTestMode", () => {
  it("is off when nothing is configured", () => {
    vi.stubEnv("VITE_TEST_MODE", undefined);
    vi.stubEnv("TEST_MODE", undefined);

    expect(isTestMode()).toBe(false);
  });

  it.each(["1", "true", "TRUE", " true ", "yes", "on"])("accepts %s", (value) => {
    vi.stubEnv("VITE_TEST_MODE", value);

    expect(isTestMode()).toBe(true);
  });

  it.each(["0", "false", "off", "no", "production", ""])("rejects %s", (value) => {
    vi.stubEnv("VITE_TEST_MODE", value);

    expect(isTestMode()).toBe(false);
  });

  it("falls back to the server's TEST_MODE when the Vite flag is absent", () => {
    vi.stubEnv("VITE_TEST_MODE", undefined);
    vi.stubEnv("TEST_MODE", "yes");

    expect(isTestMode()).toBe(true);
  });

  it("lets an explicit Vite flag win over the server fallback", () => {
    vi.stubEnv("VITE_TEST_MODE", "false");
    vi.stubEnv("TEST_MODE", "true");

    expect(isTestMode()).toBe(false);
  });
});
