import { Link, useNavigate } from 'react-router-dom';
import { LogOut, Wallet } from 'lucide-react';
import { useAuth } from '@/context/AuthContext';
import { Button } from '@/components/ui/Button';
import { Avatar } from '@/components/ui/Avatar';

export function Header() {
  const { user, profile, signOut } = useAuth();
  const navigate = useNavigate();

  async function handleSignOut() {
    await signOut();
    navigate('/login', { replace: true });
  }

  const displayName = profile?.full_name || user?.email || '';

  return (
    <header className="sticky top-0 z-10 border-b border-slate-200 bg-white/80 backdrop-blur">
      <div className="mx-auto flex h-16 max-w-3xl items-center justify-between px-4">
        <Link to="/" className="flex items-center gap-2 font-extrabold text-slate-900">
          <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-brand-600 text-white">
            <Wallet className="h-5 w-5" />
          </span>
          Divide Aí
        </Link>

        {user && (
          <div className="flex items-center gap-3">
            <div className="hidden items-center gap-2 sm:flex">
              <Avatar name={displayName} url={profile?.avatar_url} size={32} />
              <span className="max-w-[12rem] truncate text-sm text-slate-600">{displayName}</span>
            </div>
            <Button variant="ghost" size="sm" onClick={handleSignOut}>
              <LogOut className="h-4 w-4" />
              Sair
            </Button>
          </div>
        )}
      </div>
    </header>
  );
}
