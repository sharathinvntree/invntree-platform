-- ═══════════════════════════════════════════════════════════════
-- InvnTree Patent Fee Platform — Supabase Schema
-- Paste this entire file into Supabase → SQL Editor → Run
-- ═══════════════════════════════════════════════════════════════


-- ── 1. PROFILES TABLE ──────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.profiles (
  id               uuid        PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email            text        NOT NULL,
  full_name        text,
  role             text        NOT NULL DEFAULT 'user' CHECK (role IN ('admin', 'user')),
  us_patenting     boolean     NOT NULL DEFAULT false,
  india_patenting  boolean     NOT NULL DEFAULT false,
  is_active        boolean     NOT NULL DEFAULT true,
  created_at       timestamptz NOT NULL DEFAULT now(),
  updated_at       timestamptz NOT NULL DEFAULT now()
);


-- ── 2. ROW LEVEL SECURITY ──────────────────────────────────────
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

-- Security-definer function: returns current user's role without
-- triggering RLS (avoids circular policy reference)
CREATE OR REPLACE FUNCTION public.get_my_role()
RETURNS text LANGUAGE sql STABLE SECURITY DEFINER AS $$
  SELECT role FROM public.profiles WHERE id = auth.uid()
$$;

-- Each user can read their own profile
CREATE POLICY "user_read_own" ON public.profiles
  FOR SELECT USING (auth.uid() = id);

-- Admins can read ALL profiles
CREATE POLICY "admin_read_all" ON public.profiles
  FOR SELECT USING (public.get_my_role() = 'admin');

-- Admins can update ANY profile (permissions, role, status)
CREATE POLICY "admin_update_all" ON public.profiles
  FOR UPDATE USING (public.get_my_role() = 'admin');


-- ── 3. AUTO-CREATE PROFILE ON NEW SIGNUP ──────────────────────
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER AS $$
BEGIN
  INSERT INTO public.profiles (id, email, full_name)
  VALUES (
    NEW.id,
    NEW.email,
    COALESCE(NEW.raw_user_meta_data->>'full_name', split_part(NEW.email, '@', 1))
  )
  ON CONFLICT (id) DO NOTHING;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();


-- ── 4. AUTO-UPDATE updated_at ──────────────────────────────────
CREATE OR REPLACE FUNCTION public.set_updated_at()
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END;
$$;

DROP TRIGGER IF EXISTS profiles_updated_at ON public.profiles;
CREATE TRIGGER profiles_updated_at
  BEFORE UPDATE ON public.profiles
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();


-- ══════════════════════════════════════════════════════════════
-- AFTER RUNNING THIS SCHEMA:
--
-- 1. Go to Supabase → Authentication → Settings
--    • Set "Email Confirm" to OFF (so new users can log in immediately)
--
-- 2. Go to Authentication → Users → Add User
--    • Create your admin account (email + password)
--
-- 3. Run this query to promote yourself to admin
--    (replace with your email):
--
--    UPDATE public.profiles
--    SET role = 'admin'
--    WHERE email = 'your@email.com';
--
-- ══════════════════════════════════════════════════════════════
