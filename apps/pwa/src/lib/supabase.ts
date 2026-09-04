import { createClient } from '@supabase/supabase-js';

const supabaseUrl = typeof process !== 'undefined' && process.env?.VITE_SUPABASE_URL
  ? process.env.VITE_SUPABASE_URL
  : (typeof import.meta !== 'undefined' && import.meta.env?.VITE_SUPABASE_URL)
    ? import.meta.env.VITE_SUPABASE_URL
    : 'http://127.0.0.1:54321';

const supabaseAnonKey = typeof process !== 'undefined' && process.env?.VITE_SUPABASE_ANON_KEY
  ? process.env.VITE_SUPABASE_ANON_KEY
  : (typeof import.meta !== 'undefined' && import.meta.env?.VITE_SUPABASE_ANON_KEY)
    ? import.meta.env.VITE_SUPABASE_ANON_KEY
    : 'anon-key-placeholder';

const getStorage = () => {
  if (typeof window !== 'undefined' && window.localStorage) {
    return window.localStorage;
  }
  return undefined;
};

export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    persistSession: true,
    autoRefreshToken: true,
    detectSessionInUrl: true,
    storage: getStorage(),
    storageKey: 'delivrery-auth-token',
  },
});

export default supabase;
