/* Pin Drop — Supabase client config.
   These are PUBLIC keys (publishable / anon). They are meant to live in the client;
   security is enforced by Row Level Security on the database, not by hiding these.
   The service_role key is secret and must NEVER appear in client code. */
window.PINDROP_SUPABASE = {
  url: "https://arzprijpiblzyzkedsno.supabase.co",
  // Modern publishable key (recommended):
  publishableKey: "sb_publishable_cEk6HxHW5mTygwttZjL7nw_lkDrbARD",
  // Legacy anon key (kept for libraries/tools that still expect a JWT anon key):
  anonKey: "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImFyenByaWpwaWJsenl6a2Vkc25vIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODQ3NjE3NzcsImV4cCI6MjEwMDMzNzc3N30.56JpALZrlINhqOVhRiLzmPcdYVutBdeDfOmgx8SO48o"
};
