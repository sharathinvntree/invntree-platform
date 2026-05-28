// ═══════════════════════════════════════════════════════════════
// InvnTree Platform — Activity Tracking
// ═══════════════════════════════════════════════════════════════
// All functions are fire-and-forget; failures are silently ignored
// so tracking never interrupts the user experience.

// Set to true for admin users so their own browsing isn't logged.
let _trackingDisabled = false;
function disableTracking() { _trackingDisabled = true; }

// ── Core insert ────────────────────────────────────────────────
function trackEvent(userId, eventType, page, details) {
  if (_trackingDisabled || !userId || !db) return;
  db.from('user_activity').insert({
    user_id:    userId,
    event_type: eventType,
    page:       page,
    details:    details || {}
  }).then(() => {}).catch(() => {});
}

// ── Page visit ─────────────────────────────────────────────────
// Call once per page after requireAuth() resolves.
function trackPageVisit(userId, page) {
  trackEvent(userId, 'page_visit', page, {});
}

// ── Calculator run (debounced 2 s) ─────────────────────────────
// Rapid toggles consolidate into a single event.
let _calcTrackTimer = null;
function trackCalcRun(userId, page, details) {
  if (!userId) return;
  clearTimeout(_calcTrackTimer);
  _calcTrackTimer = setTimeout(() => {
    trackEvent(userId, 'calculator_run', page, details || {});
  }, 2000);
}
