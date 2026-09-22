// Bleris Cakes and Pastries — Supabase connection settings.
//
// Fill these in after creating your free Supabase project:
//   1. Go to https://supabase.com and create a project (free tier).
//   2. Run supabase/setup.sql in the SQL Editor to create + seed the products table.
//   3. In Project Settings > API, copy the "Project URL" and the "anon public" key
//      and paste them below.
//
// The anon public key is SAFE to expose in client-side code like this file —
// it is designed to be public. Row Level Security (set up by setup.sql) is what
// actually protects writes: only a signed-in user (you) can add, edit, or
// remove products. Never paste the "service_role" key here — that one must
// stay secret and is never used in the browser.
//
// Until these are filled in, the live site keeps working exactly as before
// (using the prices already written in index.html) and the admin panel will
// show a setup notice instead of a login form.

window.BLERIS_SUPABASE_URL = "https://woatwozdtooqycgyiwsy.supabase.co";
window.BLERIS_SUPABASE_ANON_KEY = "sb_publishable_YRqf_ZnVVee4t2FbJ93NjA_sgqsIfSL";
