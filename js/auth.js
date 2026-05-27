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

  // Stamp last login (fire-and-forget)
  db.from('profiles').update({ last_login_at: new Date().toISOString() }).eq('id', session.user.id);

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
  const isAdmin = profile.role === 'admin';
  const userName = profile.full_name || profile.email.split('@')[0];
  const initial = userName.charAt(0).toUpperCase();

  const NAV_LINKS = [
    { id: 'dashboard', label: 'Home', href: 'dashboard.html' },
  ];

  // Determine current page from URL
  const currentPage = window.location.pathname.split('/').pop().replace('.html','');

  const linksHtml = NAV_LINKS.map(l => {
    const active = currentPage === l.id.replace('combined','patent') || currentPage === l.id;
    return `<a class="nav-link ${active ? 'active' : ''}" href="${l.href}">${l.label}</a>`;
  }).join('');

  const adminLink = isAdmin
    ? `<a class="nav-link ${currentPage === 'admin' ? 'active' : ''}" href="admin.html">⚙ Admin</a>`
    : '';

  const menuStyles = `
    <style id="um-styles">
      .user-menu { position:absolute;top:60px;right:40px;background:#fff;border:1px solid var(--line);border-radius:12px;box-shadow:var(--shadow-lg);padding:6px;min-width:180px;z-index:200; }
      .um-item { display:flex;align-items:center;gap:10px;padding:9px 12px;border-radius:7px;font-size:13px;color:var(--ink);font-weight:500;transition:background .12s;cursor:pointer; }
      .um-item:hover { background:var(--bg); }
      .um-danger { color:var(--red); }
      .um-danger:hover { background:var(--red-tint); }
    </style>`;

  document.getElementById('navbar-slot').innerHTML = menuStyles + `
    <nav class="navbar">
      <a class="nav-brand" href="dashboard.html">
        <img src="/img/logo-color.png" alt="InvnTree" style="height:30px;display:block;width:auto">
      </a>
      ${pageTitle ? `<div class="nav-sep"></div><div class="nav-context">${pageTitle}</div>` : ''}
      <div class="nav-right">
        ${linksHtml}
        ${adminLink}
        <button class="nav-user-btn" onclick="toggleUserMenu(event)">
          <span class="avatar">${initial}</span>
          ${userName}
          <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="m6 9 6 6 6-6"/></svg>
        </button>
        <div class="user-menu" id="user-menu" style="display:none">
          <a href="dashboard.html" class="um-item">🏠 Home</a>
          <div class="um-item um-danger" onclick="signOut()">↩ Sign out</div>
        </div>
      </div>
    </nav>`;

  // Close menu on outside click
  document.addEventListener('click', () => {
    const m = document.getElementById('user-menu');
    if (m) m.style.display = 'none';
  });
}

window.toggleUserMenu = function(e) {
  e.stopPropagation();
  const m = document.getElementById('user-menu');
  m.style.display = m.style.display === 'none' ? 'block' : 'none';
};

// ── Helper: page-relative redirect ────────────────────────────
function redirect(path) {
  window.location.href = path;
}

// ── Helper: URL param ─────────────────────────────────────────
function getParam(key) {
  return new URLSearchParams(window.location.search).get(key);
}
