import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react';
import type { Session, User } from '@supabase/supabase-js';
import { supabase } from '@/lib/supabaseClient';
import { uploadAvatar } from '@/lib/storage';
import type { UserProfile } from '@/types/database.types';

interface AuthContextValue {
  session: Session | null;
  user: User | null;
  profile: UserProfile | null;
  loading: boolean;
  signIn: (email: string, password: string) => Promise<void>;
  signUp: (
    email: string,
    password: string,
    fullName: string,
    avatarFile?: File | null,
  ) => Promise<void>;
  signOut: () => Promise<void>;
  refreshProfile: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);

  const userId = session?.user?.id ?? null;

  useEffect(() => {
    // Sessão inicial (ao recarregar a página).
    supabase.auth.getSession().then(({ data }) => {
      setSession(data.session);
      setLoading(false);
    });

    // Mantém o estado sincronizado com login/logout/refresh de token.
    const { data: listener } = supabase.auth.onAuthStateChange((_event, newSession) => {
      setSession(newSession);
    });

    return () => listener.subscription.unsubscribe();
  }, []);

  const refreshProfile = useCallback(async () => {
    if (!userId) {
      setProfile(null);
      return;
    }
    const { data } = await supabase.from('users').select('*').eq('id', userId).maybeSingle();
    setProfile(data ?? null);
  }, [userId]);

  // Carrega o perfil sempre que o usuário logado muda.
  useEffect(() => {
    refreshProfile();
  }, [refreshProfile]);

  async function signIn(email: string, password: string) {
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) throw error;
  }

  async function signUp(
    email: string,
    password: string,
    fullName: string,
    avatarFile?: File | null,
  ) {
    // `full_name` vai em options.data para o trigger handle_new_user()
    // criar a linha correspondente em public.users.
    const { data, error } = await supabase.auth.signUp({
      email,
      password,
      options: { data: { full_name: fullName } },
    });
    if (error) throw error;

    // O upload exige sessão (RLS do Storage). Se a confirmação de e-mail
    // estiver ativada, não há sessão ainda — nesse caso o avatar é ignorado
    // aqui e pode ser enviado depois, na tela de perfil.
    if (avatarFile && data.user && data.session) {
      const avatarUrl = await uploadAvatar(data.user.id, avatarFile);
      await supabase.from('users').update({ avatar_url: avatarUrl }).eq('id', data.user.id);
    }
  }

  async function signOut() {
    const { error } = await supabase.auth.signOut();
    if (error) throw error;
  }

  const value = useMemo<AuthContextValue>(
    () => ({
      session,
      user: session?.user ?? null,
      profile,
      loading,
      signIn,
      signUp,
      signOut,
      refreshProfile,
    }),
    [session, profile, loading, refreshProfile],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

// eslint-disable-next-line react-refresh/only-export-components
export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth deve ser usado dentro de <AuthProvider>.');
  return ctx;
}
