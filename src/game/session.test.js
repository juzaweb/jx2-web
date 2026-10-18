// @vitest-environment jsdom
import { describe, it, expect, beforeEach } from "vitest";
import {
  readSession,
  writeSession,
  persistSessionUser,
  isSessionUser,
  clearSession
} from "./session.js";

const SESSION_KEY = "jx2_user_session";

const SESSION = {
  user: { id: "user_1", username: "hiepkhat99", displayName: "theanh" },
  token: "token-abc",
  server: "Youtube: PYTA Gaming",
  loggedInAt: 1700000000000
};

describe("session cache", () => {
  beforeEach(() => {
    localStorage.clear();
    localStorage.setItem(SESSION_KEY, JSON.stringify(SESSION));
  });

  it("reads the cached session", () => {
    expect(readSession()).toEqual(SESSION);
  });

  it("returns null when the cached session is corrupt", () => {
    localStorage.setItem(SESSION_KEY, "{not valid json");
    expect(readSession()).toBeNull();
  });

  it("returns null when no session is cached", () => {
    localStorage.clear();
    expect(readSession()).toBeNull();
  });

  it("replaces the user while keeping the fields written at login", () => {
    const refreshed = { id: "user_1", username: "hiepkhat99", displayName: "Hiệp Khách Vô Danh" };

    persistSessionUser(refreshed);

    expect(readSession()).toEqual({ ...SESSION, user: refreshed });
  });

  it("persists a user even when no session was cached before", () => {
    localStorage.clear();

    persistSessionUser({ id: "user_2", username: "theanh" });

    expect(readSession()).toEqual({ user: { id: "user_2", username: "theanh" } });
  });

  it("writes a full session", () => {
    localStorage.clear();

    writeSession(SESSION);

    expect(readSession()).toEqual(SESSION);
  });

  it("matches only the cached user id", () => {
    expect(isSessionUser("user_1")).toBe(true);
    expect(isSessionUser("user_2")).toBe(false);
  });

  it("stops matching once the session is cleared", () => {
    clearSession();

    expect(readSession()).toBeNull();
    expect(isSessionUser("user_1")).toBe(false);
  });
});
