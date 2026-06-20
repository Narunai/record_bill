import { createClient } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

let supabase: any;

if (!supabaseUrl || !supabaseAnonKey) {
  // In dev mode, don't throw to allow UI testing without Supabase configured.
  // Provide a minimal stub that logs calls and returns resolved promises
  // with an error indicator so the app doesn't crash on import.
  console.warn('VITE_SUPABASE_URL or VITE_SUPABASE_ANON_KEY not set — exporting supabase stub');

  const stubAsync = async (..._args: any[]) => ({ data: null, error: new Error('Supabase not configured') });
  // Minimal stub surface used by the app (expand if needed)
  // `auth.signOut()` is used in the dashboard; also provide signIn and signUp placeholders.
  // Other modules should handle `error` responses gracefully.
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const supabaseStub: any = {
    auth: {
      // return shape matches supabase-js v2: { data, error }
      getSession: async () => ({ data: { session: null }, error: null }),
      signOut: async () => ({ error: new Error('Supabase not configured') }),
      signInWithPassword: async () => ({ data: { session: null }, error: null }),
      signUp: async () => ({ data: { session: null }, error: null }),
    },
    from: () => ({ select: stubAsync, insert: stubAsync, update: stubAsync, delete: stubAsync }),
  };

  supabase = supabaseStub;
} else {
  supabase = createClient(supabaseUrl, supabaseAnonKey);
}

export { supabase };
