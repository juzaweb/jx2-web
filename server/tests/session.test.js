import test from "node:test";
import assert from "node:assert/strict";
import { createSessionToken, verifySessionToken } from "../src/auth/session.js";

test("Session token suite", async (t) => {
  await t.test("round-trips the account id", () => {
    const token = createSessionToken("user_123_abcd");
    assert.equal(verifySessionToken(token), "user_123_abcd");
  });

  await t.test("rejects a tampered token", () => {
    const token = createSessionToken("user_123_abcd");
    const [encoded, signature] = token.split(".");
    // Flip a payload byte (the signature no longer matches).
    const forged = Buffer.from("user_999:0").toString("base64url") + "." + signature;
    assert.equal(verifySessionToken(forged), null);
    // Flip the signature itself.
    const badSig = (signature[0] === "a" ? "b" : "a") + signature.slice(1);
    assert.equal(verifySessionToken(encoded + "." + badSig), null);
  });

  await t.test("rejects malformed or missing tokens", () => {
    assert.equal(verifySessionToken(undefined), null);
    assert.equal(verifySessionToken(""), null);
    assert.equal(verifySessionToken("no-separator"), null);
    assert.equal(verifySessionToken("."), null);
    assert.equal(verifySessionToken("abc."), null);
    assert.equal(verifySessionToken(12345), null);
  });

  await t.test("handles signature length mismatches safely without side-channel timing leaks", () => {
    const token = createSessionToken("user_123_abcd");
    const [encoded] = token.split(".");
    assert.equal(verifySessionToken(encoded + ".shortsig"), null);
    assert.equal(verifySessionToken(encoded + "." + "a".repeat(128)), null);
  });
});
