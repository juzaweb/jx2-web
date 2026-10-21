/**
 * Utility functions to detect mobile environments, trigger fullscreen mode,
 * and lock screen orientation to landscape when entering the game.
 */

/**
 * Checks if the current user agent or device capabilities indicate a mobile/tablet environment.
 * @returns {boolean}
 */
export function isMobileDevice() {
  if (typeof window === "undefined" || typeof navigator === "undefined") {
    return false;
  }

  const userAgent = navigator.userAgent || navigator.vendor || window.opera || "";
  const isMobileUA = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(userAgent);
  const isTouchDevice =
    ("ontouchstart" in window || (navigator.maxTouchPoints && navigator.maxTouchPoints > 0)) &&
    window.innerWidth <= 1024;

  return isMobileUA || isTouchDevice;
}

/**
 * Attempts to trigger browser Fullscreen and lock screen orientation to landscape.
 * Must be called within a user gesture (e.g., click or touch event handler).
 * @param {boolean} [force=false] - Whether to request landscape fullscreen regardless of mobile check.
 * @returns {Promise<boolean>} Resolves to true if fullscreen/lock succeeded or attempted cleanly.
 */
export async function requestLandscapeFullscreen(force = false) {
  if (typeof window === "undefined" || typeof document === "undefined") {
    return false;
  }

  // Only run automatically on mobile devices unless forced
  if (!force && !isMobileDevice()) {
    return false;
  }

  let fullscreenDone = false;

  // 1. Request Fullscreen Mode
  const docEl = document.documentElement;
  const isFS =
    document.fullscreenElement ||
    document.webkitFullscreenElement ||
    document.mozFullScreenElement ||
    document.msFullscreenElement;

  if (!isFS && docEl) {
    const requestFS =
      docEl.requestFullscreen ||
      docEl.webkitRequestFullscreen ||
      docEl.mozRequestFullScreen ||
      docEl.msRequestFullscreen;

    if (requestFS) {
      try {
        await requestFS.call(docEl);
        fullscreenDone = true;
      } catch (err) {
        // Fullscreen request may fail if user gesture expired or browser permissions block it
      }
    }
  } else {
    fullscreenDone = true;
  }

  // 2. Lock Orientation to Landscape
  if (window.screen) {
    const screenObj = window.screen;
    if (screenObj.orientation && typeof screenObj.orientation.lock === "function") {
      try {
        await screenObj.orientation.lock("landscape");
      } catch (err) {
        // Orientation lock may fail if unsupported on device (e.g., iOS Safari)
      }
    } else {
      const lockFn =
        screenObj.lockOrientation ||
        screenObj.webkitLockOrientation ||
        screenObj.mozLockOrientation ||
        screenObj.msLockOrientation;

      if (typeof lockFn === "function") {
        try {
          lockFn.call(screenObj, "landscape");
        } catch (err) {
          // Ignore orientation lock errors
        }
      }
    }
  }

  return fullscreenDone;
}
