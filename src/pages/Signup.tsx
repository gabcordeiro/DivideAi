import { useEffect, useRef, useState, type ChangeEvent, type FormEvent } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Wallet, Camera, User, X } from 'lucide-react';
import { useAuth } from '@/context/AuthContext';
import { validateAvatar } from '@/lib/storage';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Card } from '@/components/ui/Card';

export function Signup() {
  const { signUp } = useAuth();
  const navigate = useNavigate();

  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');

  const [avatarFile, setAvatarFile] = useState<File | null>(null);
  const [avatarPreview, setAvatarPreview] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  const [loading, setLoading] = useState(false);

  // Libera o object URL do preview ao trocar/desmontar.
  useEffect(() => {
    return () => {
      if (avatarPreview) URL.revokeObjectURL(avatarPreview);
    };
  }, [avatarPreview]);

  function handleAvatarChange(e: ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;

    const validationError = validateAvatar(file);
    if (validationError) {
      setError(validationError);
      return;
    }

    setError(null);
    if (avatarPreview) URL.revokeObjectURL(avatarPreview);
    setAvatarFile(file);
    setAvatarPreview(URL.createObjectURL(file));
  }

  function removeAvatar() {
    if (avatarPreview) URL.revokeObjectURL(avatarPreview);
    setAvatarFile(null);
    setAvatarPreview(null);
    if (fileInputRef.current) fileInputRef.current.value = '';
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);

    if (password.length < 6) return setError('A senha deve ter ao menos 6 caracteres.');
    if (password !== confirmPassword) return setError('As senhas não conferem.');

    setLoading(true);
    try {
      await signUp(email, password, fullName.trim(), avatarFile);
      setSuccess(true);
      setTimeout(() => navigate('/', { replace: true }), 1200);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Não foi possível cadastrar.');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="flex min-h-screen items-center justify-center px-4 py-8">
      <div className="w-full max-w-sm">
        <div className="mb-6 flex flex-col items-center text-center">
          <span className="mb-3 flex h-12 w-12 items-center justify-center rounded-xl bg-brand-600 text-white">
            <Wallet className="h-7 w-7" />
          </span>
          <h1 className="text-2xl font-extrabold">Criar conta</h1>
          <p className="text-sm text-slate-500">Comece a rachar contas em segundos.</p>
        </div>

        <Card>
          {success ? (
            <p className="rounded-lg bg-brand-50 px-3 py-2 text-sm text-brand-700">
              Conta criada! Redirecionando…
            </p>
          ) : (
            <form onSubmit={handleSubmit} className="space-y-4">
              {/* Avatar */}
              <div className="flex flex-col items-center gap-2">
                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  className="group relative"
                  aria-label="Escolher foto de perfil"
                >
                  <span className="flex h-24 w-24 items-center justify-center overflow-hidden rounded-full border-2 border-dashed border-slate-300 bg-slate-50 transition group-hover:border-brand-400">
                    {avatarPreview ? (
                      <img src={avatarPreview} alt="Prévia do avatar" className="h-full w-full object-cover" />
                    ) : (
                      <User className="h-8 w-8 text-slate-400" />
                    )}
                  </span>
                  <span className="absolute bottom-0 right-0 flex h-7 w-7 items-center justify-center rounded-full bg-brand-600 text-white ring-2 ring-white">
                    <Camera className="h-4 w-4" />
                  </span>
                </button>

                {avatarPreview ? (
                  <button
                    type="button"
                    onClick={removeAvatar}
                    className="inline-flex items-center gap-1 text-xs font-medium text-slate-500 hover:text-red-600"
                  >
                    <X className="h-3.5 w-3.5" />
                    Remover foto
                  </button>
                ) : (
                  <span className="text-xs text-slate-400">Foto de perfil (opcional)</span>
                )}

                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/*"
                  className="hidden"
                  onChange={handleAvatarChange}
                />
              </div>

              <Input
                label="Nome completo"
                required
                value={fullName}
                onChange={(e) => setFullName(e.target.value)}
                placeholder="Maria Silva"
              />
              <Input
                label="E-mail"
                type="email"
                autoComplete="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="voce@email.com"
              />
              <Input
                label="Senha"
                type="password"
                autoComplete="new-password"
                required
                minLength={6}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Mínimo 6 caracteres"
              />
              <Input
                label="Confirmar senha"
                type="password"
                autoComplete="new-password"
                required
                minLength={6}
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                placeholder="Repita a senha"
                hint={
                  confirmPassword.length > 0 && password !== confirmPassword
                    ? '⚠️ As senhas não conferem.'
                    : undefined
                }
              />

              {error && (
                <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>
              )}

              <Button type="submit" size="lg" loading={loading} className="w-full">
                Cadastrar
              </Button>
            </form>
          )}
        </Card>

        <p className="mt-4 text-center text-sm text-slate-500">
          Já tem conta?{' '}
          <Link to="/login" className="font-semibold text-brand-700 hover:underline">
            Entrar
          </Link>
        </p>
      </div>
    </div>
  );
}
