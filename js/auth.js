// ═══════════════════════════════════════════════════════════════
// InvnTree Platform — Auth Utilities
// ═══════════════════════════════════════════════════════════════

// ── Require authenticated user ─────────────────────────────────
// Redirects to login if no session; returns { session, profile }
async function requireAuth() {
  const { data: { session } } = await db.auth.getSession();
  if (!session) { redirect('index.html'); return null; }

  const { data: profile, error } = await db
    .from('profiles')
    .select('*')
    .eq('id', session.user.id)
    .single();

  if (error || !profile) { await db.auth.signOut(); redirect('index.html'); return null; }

  if (!profile.is_active) {
    await db.auth.signOut();
    redirect('index.html?reason=inactive');
    return null;
  }

  return { session, profile };
}

// ── Require admin role ─────────────────────────────────────────
async function requireAdmin() {
  const auth = await requireAuth();
  if (!auth) return null;
  if (auth.profile.role !== 'admin') { redirect('dashboard.html'); return null; }
  return auth;
}

// ── Sign out ───────────────────────────────────────────────────
async function signOut() {
  await db.auth.signOut();
  redirect('index.html');
}

// ── Inject shared navbar ───────────────────────────────────────
function renderNavbar(profile, pageTitle = '') {
  const adminBtn = profile.role === 'admin'
    ? `<a href="admin.html" class="btn btn-nav-outline btn-sm">⚙ Admin</a>` : '';

  document.getElementById('navbar-slot').innerHTML = `
    <nav class="navbar">
      <div class="nav-brand">
        <div class="nav-logo">InvnTree</div>
        <div class="nav-tag">Intellectual Property</div>
      </div>
      <div class="nav-sep"></div>
      ${pageTitle ? `<div class="nav-title">${pageTitle}</div>` : ''}
      <div class="nav-right">
        ${adminBtn}
        <span class="nav-user">Hi, <strong>${profile.full_name || profile.email.split('@')[0]}</strong></span>
        <button class="btn btn-nav-outline btn-sm" onclick="signOut()">Sign Out</button>
      </div>
    </nav>`;
}

// ── Helper: page-relative redirect ────────────────────────────
function redirect(path) {
  window.location.href = path;
}

// ── Helper: URL param ─────────────────────────────────────────
function getParam(key) {
  return new URLSearchParams(window.location.search).get(key);
}
