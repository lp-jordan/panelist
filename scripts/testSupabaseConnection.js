/* eslint-env node */
/* global process */
import { createClient } from '@supabase/supabase-js';

const { VITE_SUPABASE_URL, VITE_SUPABASE_ANON_KEY } = process.env;

if (!VITE_SUPABASE_URL || !VITE_SUPABASE_ANON_KEY) {
  console.error('Missing VITE_SUPABASE_URL or VITE_SUPABASE_ANON_KEY environment variables.');
  process.exit(1);
}

const supabase = createClient(VITE_SUPABASE_URL, VITE_SUPABASE_ANON_KEY);

async function main() {
  try {
    const { error } = await supabase.auth.getSession();
    if (error) throw error;
    console.log('Successfully connected to Supabase.');
  } catch (err) {
    console.error('Failed to connect to Supabase:', err.message);
    process.exit(1);
  }
}

main();
