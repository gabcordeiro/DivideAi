import { Navigate, Outlet, useLocation } from 'react-router-dom';
import { useAuth } from '@/context/AuthContext';
import { Header } from '@/components/layout/Header';
import { Spinner } from '@/components/ui/Spinner';

/**
 * Envolve as rotas autenticadas. Enquanto a sessão carrega, mostra um spinner;
 * sem sessão, redireciona para /login preservando a rota de destino.
 */
export function ProtectedRoute() {
  const { session, loading } = useAuth();
  const location = useLocation();

  if (loading) return <Spinner label="Carregando sua sessão…" />;

  if (!session) {
    return <Navigate to="/login" replace state={{ from: location }} />;
  }

  return (
    <div className="min-h-screen">
      <Header />
      <main className="mx-auto max-w-3xl px-4 py-6">
        <Outlet />
      </main>
    </div>
  );
}
