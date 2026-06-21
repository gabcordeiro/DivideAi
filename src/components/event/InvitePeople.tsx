import { useEffect, useState } from 'react';
import { Copy, Check, Share2, UserPlus, Search } from 'lucide-react';
import { supabase } from '@/lib/supabaseClient';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Avatar } from '@/components/ui/Avatar';
import type { PublicProfile } from '@/types/database.types';

interface InvitePeopleProps {
  eventId: string;
  eventTitle: string;
  isCreator: boolean;
  existingUserIds: string[];
  onAdded: () => void;
}

export function InvitePeople({
  eventId,
  eventTitle,
  isCreator,
  existingUserIds,
  onAdded,
}: InvitePeopleProps) {
  const inviteLink = `${window.location.origin}/events/${eventId}`;
  const whatsappUrl = `https://wa.me/?text=${encodeURIComponent(
    `Bora rachar "${eventTitle}" no Divide Aí? Entra aqui: ${inviteLink}`,
  )}`;

  const [copied, setCopied] = useState(false);
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<PublicProfile[]>([]);
  const [searching, setSearching] = useState(false);
  const [addingId, setAddingId] = useState<string | null>(null);

  async function copyLink() {
    await navigator.clipboard.writeText(inviteLink);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  }

  // Busca de usuários por nome (com debounce simples).
  useEffect(() => {
    if (!isCreator) return;
    const q = query.trim();
    if (q.length < 2) {
      setResults([]);
      return;
    }

    let active = true;
    setSearching(true);
    const timer = setTimeout(async () => {
      const { data } = await supabase
        .from('users')
        .select('id, full_name, avatar_url')
        .ilike('full_name', `%${q}%`)
        .limit(6);
      if (!active) return;
      setResults((data ?? []).filter((u) => !existingUserIds.includes(u.id)));
      setSearching(false);
    }, 300);

    return () => {
      active = false;
      clearTimeout(timer);
    };
  }, [query, isCreator, existingUserIds]);

  async function addParticipant(userId: string) {
    setAddingId(userId);
    const { error } = await supabase
      .from('participants')
      .insert({ event_id: eventId, user_id: userId });
    setAddingId(null);
    if (!error) {
      setQuery('');
      setResults([]);
      onAdded();
    }
  }

  return (
    <Card className="space-y-4">
      <h2 className="flex items-center gap-2 font-semibold">
        <UserPlus className="h-4 w-4 text-slate-500" />
        Convidar pessoas
      </h2>

      {/* Link de convite */}
      <div className="flex items-center gap-2 rounded-xl bg-slate-50 p-2">
        <span className="min-w-0 flex-1 truncate px-1 font-mono text-xs text-slate-600">
          {inviteLink}
        </span>
        <Button size="sm" variant="secondary" onClick={copyLink}>
          {copied ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
          {copied ? 'Copiado' : 'Copiar'}
        </Button>
        <a href={whatsappUrl} target="_blank" rel="noreferrer">
          <Button size="sm" variant="secondary">
            <Share2 className="h-4 w-4" />
            WhatsApp
          </Button>
        </a>
      </div>

      {/* Adicionar pela plataforma (só o criador) */}
      {isCreator && (
        <div className="space-y-2">
          <div className="relative">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
            <input
              className="field pl-9"
              placeholder="Buscar usuário pelo nome…"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
            />
          </div>

          {query.trim().length >= 2 && (
            <ul className="space-y-1">
              {searching && <li className="px-1 py-2 text-sm text-slate-400">Buscando…</li>}
              {!searching && results.length === 0 && (
                <li className="px-1 py-2 text-sm text-slate-400">Ninguém encontrado.</li>
              )}
              {results.map((u) => (
                <li
                  key={u.id}
                  className="flex items-center justify-between rounded-lg border border-slate-200 p-2"
                >
                  <div className="flex items-center gap-2">
                    <Avatar name={u.full_name} url={u.avatar_url} size={32} />
                    <span className="text-sm font-medium">{u.full_name}</span>
                  </div>
                  <Button
                    size="sm"
                    onClick={() => addParticipant(u.id)}
                    loading={addingId === u.id}
                  >
                    <UserPlus className="h-4 w-4" />
                    Adicionar
                  </Button>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </Card>
  );
}
