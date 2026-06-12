import { createClient } from '@supabase/supabase-js';
import { env } from './env';

/**
 * Anon client — for public Supabase Auth operations if needed.
 */
export const supabaseAnon = createClient(
  env.SUPABASE_URL,
  env.SUPABASE_ANON_KEY
);

/**
 * Service role client — full database access for server-side operations.
 * Authorization (org scoping, roles) is enforced in application code.
 * Never expose to frontend or user-supplied input.
 */
export const supabaseAdmin = createClient(
  env.SUPABASE_URL,
  env.SUPABASE_SERVICE_ROLE_KEY,
  {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  }
);

/**
 * Create a user-scoped Supabase client using the request's JWT.
 */
export function supabaseForUser(accessToken: string) {
  return createClient(env.SUPABASE_URL, env.SUPABASE_ANON_KEY, {
    global: { headers: { Authorization: `Bearer ${accessToken}` } },
    auth: { autoRefreshToken: false, persistSession: false },
  });
}
