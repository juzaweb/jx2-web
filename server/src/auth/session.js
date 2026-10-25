import crypto from "node:crypto";
import { config } from "../config.js";

/**
 * Lightweight HMAC-signed session tokens: base64url(userId:issuedAt).hmac.
 *
 * The token only proves *which account* a request belongs to. It is not an
 * authorization grant by itself: callers (the API, the WebSocket join) still
 * have to check that the requested resource belongs to that account.
 */

const sign = (payload) =>
  crypto.createHmac("sha256", config.sessionSecret).update(payload).digest("hex");

/**
 * @param {string} userId
 * @param {number} [issuedAt]
 * @returns {string}
 */
export const createSessionToken = (userId, issuedAt = Date.now()) => {
  const payload = userId + ":" + issuedAt;
  return Buffer.from(payload).toString("base64url") + "." + sign(payload);
};

/**
 * Verify a session token's signature and return its account id, or null when the
 * token is missing, malformed or tampered with.
 * @param {*} token
 * @returns {string|null}
 */
export const verifySessionToken = (token) => {
  if (typeof token !== "string") return null;
  const dot = token.lastIndexOf(".");
  if (dot <= 0) return null;

  const encoded = token.slice(0, dot);
  const signature = token.slice(dot + 1);
  let payload;
  try {
    payload = Buffer.from(encoded, "base64url").toString("utf8");
  } catch {
    return null;
  }

  // Security: Compare signatures in constant time without leaking length differences via early return
  const expectedBuf = Buffer.from(sign(payload));
  const providedBuf = Buffer.from(signature);
  const isSameLength = expectedBuf.length === providedBuf.length;
  const compareBuf = isSameLength ? providedBuf : expectedBuf;
  const isSignatureValid = crypto.timingSafeEqual(expectedBuf, compareBuf) && isSameLength;

  if (!isSignatureValid) {
    return null;
  }

  const sep = payload.lastIndexOf(":");
  const userId = sep > 0 ? payload.slice(0, sep) : "";
  return userId || null;
};
