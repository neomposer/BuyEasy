// BUYEasy Supabase connection
// The publishable key below is meant to be public. Real protection comes from
// Row Level Security rules and the database functions in Supabase.
// NEVER put a service_role / secret key in this file.
const SUPABASE_URL = 'https://xqkmkwhlovvucuejmplr.supabase.co';
const SUPABASE_ANON_KEY = 'sb_publishable_RZS2kP94mJL4rbb47unAzQ_bXYOSuOy';

window.supabaseClient = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
