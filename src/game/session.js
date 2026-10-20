/**
 * Cached login session stored in localStorage.
 * The session is rewritten at login and refreshed against the backend profile,
 * so it must stay readable by the game scene and the React HUD.
 */
const SESSION_KEY = "jx2_user_session";

/**
 * Read the cached session.
 * @returns {Object|null} Parsed session, or null when missing/corrupt
 */
export const readSession = () => {
  try {
    const raw = localStorage.getItem(SESSION_KEY);
    const session = raw ? JSON.parse(raw) : null;
    return session && typeof session === "object" ? session : null;
  } catch {
    return null;
  }
};

/**
 * Cache a full session. Written when the player logs in or registers.
 * @param {Object} session
 */
export const writeSession = (session) => {
  try {
    localStorage.setItem(SESSION_KEY, JSON.stringify(session));
  } catch {
    // Ignore storage failures (private mode, quota)
  }
};

/**
 * Replace the cached user, keeping the token/server fields written at login.
 * @param {Object} user
 */
export const persistSessionUser = (user) => {
  const session = readSession() || {};
  try {
    localStorage.setItem(SESSION_KEY, JSON.stringify({ ...session, user }));
  } catch {
    // Ignore storage failures (private mode, quota)
  }
};

/**
 * Check whether the cached session still belongs to the given user.
 * Guards async profile refreshes against a session replaced in the meantime.
 * @param {string} userId
 * @returns {boolean}
 */
export const isSessionUser = (userId) => readSession()?.user?.id === userId;

/**
 * Remove the cached session
 */
export const clearSession = () => {
  try {
    localStorage.removeItem(SESSION_KEY);
  } catch {
    // Ignore storage failures (private mode)
  }
};
