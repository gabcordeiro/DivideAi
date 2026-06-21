import { createClient } from '@supabase/supabase-js';
import type { Database } from '@/types/database.types';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseAnonKey) {
  throw new Error(
    'Variáveis de ambiente do Supabase ausentes. ' +
      'Crie um arquivo `.env` na raiz do projeto com VITE_SUPABASE_URL e ' +
      'VITE_SUPABASE_ANON_KEY (veja `.env.example`).',
  );
}

/**
 * Cliente Supabase tipado e único para toda a aplicação.
 * O genérico <Database> dá autocomplete e checagem de tipos em
 * todas as queries (`.from('events')`, `.select(...)`, etc).
 */
export const supabase = createClient<Database>(supabaseUrl, supabaseAnonKey, {
  auth: {
    persistSession: true,
    autoRefreshToken: true,
    detectSessionInUrl: true,
  },
});
