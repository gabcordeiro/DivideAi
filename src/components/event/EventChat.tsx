import { useEffect, useRef, useState, type FormEvent } from 'react';
import { Send, MessageCircle } from 'lucide-react';
import { supabase } from '@/lib/supabaseClient';
import { Card } from '@/components/ui/Card';
import { Avatar } from '@/components/ui/Avatar';
import { Button } from '@/components/ui/Button';
import type { MessageRow, PublicProfile } from '@/types/database.types';

interface EventChatProps {
  eventId: string;
  currentUserId: string;
  /** Lookup de perfis (participantes) para exibir nome e avatar. */
  profiles: Record<string, PublicProfile>;
}

export function EventChat({ eventId, currentUserId, profiles }: EventChatProps) {
  const [messages, setMessages] = useState<MessageRow[]>([]);
  const [draft, setDraft] = useState('');
  const [sending, setSending] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    let active = true;

    supabase
      .from('messages')
      .select('*')
      .eq('event_id', eventId)
      .order('created_at')
      .then(({ data }) => {
        if (active && data) setMessages(data);
      });

    // Realtime: novas mensagens chegam aqui (inclusive as nossas).
    const channel = supabase
      .channel(`messages:${eventId}`)
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'messages', filter: `event_id=eq.${eventId}` },
        (payload) => {
          const msg = payload.new as MessageRow;
          setMessages((prev) =>
            prev.some((m) => m.id === msg.id) ? prev : [...prev, msg],
          );
        },
      )
      .subscribe();

    return () => {
      active = false;
      supabase.removeChannel(channel);
    };
  }, [eventId]);

  // Rola para a última mensagem.
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages.length]);

  async function sendMessage(e: FormEvent) {
    e.preventDefault();
    const content = draft.trim();
    if (!content) return;

    setSending(true);
    setDraft('');
    const { error } = await supabase
      .from('messages')
      .insert({ event_id: eventId, user_id: currentUserId, content });
    if (error) setDraft(content); // devolve o texto se falhar
    setSending(false);
  }

  return (
    <Card className="flex flex-col">
      <h2 className="mb-3 flex items-center gap-2 font-semibold">
        <MessageCircle className="h-4 w-4 text-slate-500" />
        Chat do evento
      </h2>

      <div className="max-h-80 space-y-3 overflow-y-auto pr-1">
        {messages.length === 0 ? (
          <p className="py-8 text-center text-sm text-slate-400">
            Ninguém falou nada ainda. Quebre o gelo! 👋
          </p>
        ) : (
          messages.map((msg) => {
            const mine = msg.user_id === currentUserId;
            const author = profiles[msg.user_id];
            const name = author?.full_name ?? 'Usuário';
            return (
              <div key={msg.id} className={`flex gap-2 ${mine ? 'flex-row-reverse' : ''}`}>
                <Avatar name={name} url={author?.avatar_url} size={32} className="mt-0.5" />
                <div className={`max-w-[75%] ${mine ? 'text-right' : ''}`}>
                  {!mine && <p className="mb-0.5 text-xs font-medium text-slate-500">{name}</p>}
                  <div
                    className={`inline-block rounded-2xl px-3 py-2 text-sm ${
                      mine
                        ? 'rounded-tr-sm bg-brand-600 text-white'
                        : 'rounded-tl-sm bg-slate-100 text-slate-800'
                    }`}
                  >
                    {msg.content}
                  </div>
                </div>
              </div>
            );
          })
        )}
        <div ref={bottomRef} />
      </div>

      <form onSubmit={sendMessage} className="mt-3 flex items-center gap-2">
        <input
          className="field"
          placeholder="Escreva uma mensagem…"
          value={draft}
          maxLength={2000}
          onChange={(e) => setDraft(e.target.value)}
        />
        <Button type="submit" size="md" loading={sending} disabled={!draft.trim()} aria-label="Enviar">
          <Send className="h-4 w-4" />
        </Button>
      </form>
    </Card>
  );
}
