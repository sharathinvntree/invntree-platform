// ═══════════════════════════════════════════════════════════════
// InvnTree Platform — Supabase Configuration
//
// Fill in your project details from:
// Supabase Dashboard → Settings → API
// ═══════════════════════════════════════════════════════════════

const SUPABASE_URL  = 'https://smyuglwjazyvlvypbpqv.supabase.co';
const SUPABASE_ANON = 'sb_publishable__WE3BU4nOoT5bdJczE_moQ_x16FAwvf';

// ── Initialise client ──────────────────────────────────────────
const { createClient } = window.supabase;
const db = createClient(SUPABASE_URL, SUPABASE_ANON);
