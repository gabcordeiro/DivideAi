import { useCallback, useEffect, useMemo, useState, type FormEvent } from 'react';
import { useParams, Link } from 'react-router-dom';
import {
  ArrowLeft,
  Crown,
  Vote,
  KeyRound,
  Copy,
  Check,
  HandCoins,
  ShoppingCart,
  Users,
  Trophy,
  PartyPopper,
  CheckCheck,
} from 'lucide-react';
import { supabase } from '@/lib/supabaseClient';
import { useAuth } from '@/context/AuthContext';
import { formatCurrency, splitPerPerson } from '@/lib/format';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Card } from '@/components/ui/Card';
import { Spinner } from '@/components/ui/Spinner';
import { StatusBadge } from '@/components/ui/StatusBadge';
import { Avatar } from '@/components/ui/Avatar';
import { EventChat } from '@/components/event/EventChat';
import { InvitePeople } from '@/components/event/InvitePeople';
import type {
  EventRow,
  ItemRow,
  ParticipantWithProfile,
  PublicProfile,
  UserProfile,
} from '@/types/database.types';

export function EventDetails() {
  const { eventId } = useParams<{ eventId: string }>();
  const { user } = useAuth();

  const [event, setEvent] = useState<EventRow | null>(null);
  const [items, setItems] = useState<ItemRow[]>([]);
  const [participants, setParticipants] = useState<ParticipantWithProfile[]>([]);
  const [myProfile, setMyProfile] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [notMember, setNotMember] = useState(false);

  /* ------------------------------------------------------------------ *
   * Carregamento (evento + itens + participantes + meu perfil)
   * ------------------------------------------------------------------ */
  const fetchAll = useCallback(async () => {
    if (!eventId || !user) return;

    const [eventRes, itemsRes, partsRes, profileRes] = await Promise.all([
      supabase.from('events').select('*').eq('id', eventId).maybeSingle(),
      supabase.from('items').select('*').eq('event_id', eventId).order('created_at'),
      supabase
        .from('participants')
        .select('*, user:users!participants_user_id_fkey(id, full_name, avatar_url)')
        .eq('event_id', eventId)
        .order('created_at')
        .returns<ParticipantWithProfile[]>(),
      supabase.from('users').select('*').eq('id', user.id).maybeSingle(),
    ]);

    if (!eventRes.data) {
      setNotMember(true);
      setLoading(false);
      return;
    }

    setEvent(eventRes.data);
    setItems(itemsRes.data ?? []);
    setParticipants(partsRes.data ?? []);
    setMyProfile(profileRes.data ?? null);
    setNotMember(false);
    setLoading(false);
  }, [eventId, user]);

  /* ------------------------------------------------------------------ *
   * Realtime: re-busca em qualquer mudança do evento.
   * ------------------------------------------------------------------ */
  useEffect(() => {
    if (!eventId) return;
    fetchAll();

    const channel = supabase
      .channel(`event:${eventId}`)
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'participants', filter: `event_id=eq.${eventId}` },
        () => fetchAll(),
      )
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'events', filter: `id=eq.${eventId}` },
        () => fetchAll(),
      )
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'items', filter: `event_id=eq.${eventId}` },
        () => fetchAll(),
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [eventId, fetchAll]);

  /* ------------------------------------------------------------------ *
   * Valores derivados
   * ------------------------------------------------------------------ */
  const me = useMemo(
    () => participants.find((p) => p.user_id === user?.id) ?? null,
    [participants, user],
  );
  const isCreator = !!event && !!user && event.created_by === user.id;
  const isTreasurer = !!event && !!user && event.treasurer_id === user.id;
  const perPerson = splitPerPerson(event?.total_amount ?? 0, participants.length || 1);

  const profilesById = useMemo<Record<string, PublicProfile>>(
    () => Object.fromEntries(participants.map((p) => [p.user_id, p.user])),
    [participants],
  );

  const voteCounts = useMemo(() => {
    const counts = new Map<string, number>();
    for (const p of participants) {
      if (p.voted_for_id) counts.set(p.voted_for_id, (counts.get(p.voted_for_id) ?? 0) + 1);
    }
    return counts;
  }, [participants]);

  /* ------------------------------------------------------------------ *
   * Ações
   * ------------------------------------------------------------------ */
  async function joinEvent() {
    if (!eventId || !user) return;
    setError(null);
    const { error: err } = await supabase
      .from('participants')
      .insert({ event_id: eventId, user_id: user.id });
    if (err) return setError(err.message);
    await fetchAll();
  }

  async function castVote(candidateUserId: string) {
    if (!me) return;
    setError(null);
    const { error: err } = await supabase
      .from('participants')
      .update({ voted_for_id: candidateUserId })
      .eq('id', me.id);
    if (err) setError(err.message);
  }

  async function closeVoting() {
    if (!event) return;
    setError(null);
    let winner: string | null = null;
    let max = -1;
    for (const [uid, count] of voteCounts) {
      if (count > max) {
        max = count;
        winner = uid;
      }
    }
    if (!winner) return setError('Ninguém votou ainda — peça para a galera votar.');
    const { error: err } = await supabase
      .from('events')
      .update({ treasurer_id: winner, status: 'collecting' })
      .eq('id', event.id);
    if (err) setError(err.message);
  }

  /** Modo "Eu defino": o criador escolhe/troca o tesoureiro diretamente. */
  async function assignTreasurer(userId: string) {
    if (!event) return;
    setError(null);
    const { error: err } = await supabase
      .from('events')
      .update({ treasurer_id: userId, status: 'collecting' })
      .eq('id', event.id);
    if (err) setError(err.message);
  }

  async function markAsPaid() {
    if (!me) return;
    setError(null);
    const { error: err } = await supabase
      .from('participants')
      .update({ payment_status: 'paid_unconfirmed' })
      .eq('id', me.id);
    if (err) setError(err.message);
  }

  async function confirmReceipt(participantId: string) {
    setError(null);
    const { error: err } = await supabase
      .from('participants')
      .update({ payment_status: 'confirmed' })
      .eq('id', participantId);
    if (err) setError(err.message);
  }

  async function finishEvent() {
    if (!event) return;
    setError(null);
    const { error: err } = await supabase
      .from('events')
      .update({ status: 'finished' })
      .eq('id', event.id);
    if (err) setError(err.message);
  }

  /* ------------------------------------------------------------------ *
   * Render
   * ------------------------------------------------------------------ */
  if (loading) return <Spinner label="Carregando evento…" />;

  if (notMember) {
    return (
      <Card className="space-y-4 text-center">
        <Users className="mx-auto h-10 w-10 text-brand-500" />
        <div>
          <p className="font-semibold">Você foi convidado para este evento</p>
          <p className="text-sm text-slate-500">Entre para ver os itens e participar do rateio.</p>
        </div>
        <Button onClick={joinEvent}>Entrar no evento</Button>
        {error && <p className="text-sm text-red-700">{error}</p>}
      </Card>
    );
  }

  if (!event) return <p className="text-slate-500">Evento não encontrado.</p>;

  const canAssignTreasurer =
    isCreator && event.treasurer_mode === 'direct' && event.status !== 'finished';

  return (
    <div className="space-y-6">
      <Link
        to="/"
        className="inline-flex items-center gap-1.5 text-sm font-medium text-slate-500 hover:text-slate-800"
      >
        <ArrowLeft className="h-4 w-4" />
        Voltar
      </Link>

      {/* Cabeçalho */}
      <div className="flex items-start justify-between gap-4">
        <div className="min-w-0">
          <h1 className="text-2xl font-extrabold">{event.title}</h1>
          <div className="mt-2 flex items-center gap-2">
            <div className="flex -space-x-2">
              {participants.slice(0, 5).map((p) => (
                <Avatar
                  key={p.id}
                  name={p.user.full_name}
                  url={p.user.avatar_url}
                  size={28}
                  className="ring-2 ring-white"
                />
              ))}
            </div>
            <span className="text-sm text-slate-500">{participants.length} participante(s)</span>
          </div>
        </div>
        <div className="text-right">
          <p className="text-xs uppercase tracking-wide text-slate-400">Total</p>
          <p className="text-2xl font-extrabold text-brand-700">
            {formatCurrency(event.total_amount)}
          </p>
        </div>
      </div>

      {event.status === 'finished' && (
        <div className="flex items-center gap-2 rounded-xl bg-brand-50 px-4 py-3 text-brand-800">
          <PartyPopper className="h-5 w-5" />
          <span className="text-sm font-semibold">Evento finalizado! Conta fechada. 🎉</span>
        </div>
      )}

      {/* Itens */}
      <Card>
        <h2 className="mb-3 flex items-center gap-2 font-semibold">
          <ShoppingCart className="h-4 w-4 text-slate-500" />
          Itens
        </h2>
        <ul className="divide-y divide-slate-100">
          {items.map((item) => (
            <li key={item.id} className="flex items-center justify-between py-2.5 text-sm">
              <span className="text-slate-700">{item.name}</span>
              <span className="font-medium">{formatCurrency(item.price)}</span>
            </li>
          ))}
        </ul>
      </Card>

      {/* Convite */}
      <InvitePeople
        eventId={event.id}
        eventTitle={event.title}
        isCreator={isCreator}
        existingUserIds={participants.map((p) => p.user_id)}
        onAdded={fetchAll}
      />

      {error && <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>}

      {/* ETAPA 1 — definição do tesoureiro */}
      {event.status === 'voting' && event.treasurer_mode === 'vote' && (
        <VotingCard
          participants={participants}
          voteCounts={voteCounts}
          myVote={me?.voted_for_id ?? null}
          canVote={!!me}
          isCreator={isCreator}
          onVote={castVote}
          onClose={closeVoting}
        />
      )}

      {event.status === 'voting' && event.treasurer_mode === 'direct' && (
        <Card className="space-y-3">
          <h2 className="flex items-center gap-2 font-semibold">
            <Crown className="h-5 w-5 text-amber-500" /> Definir tesoureiro
          </h2>
          {isCreator ? (
            <ul className="space-y-2">
              {participants.map((p) => (
                <li
                  key={p.id}
                  className="flex items-center justify-between rounded-xl border border-slate-200 p-3"
                >
                  <div className="flex items-center gap-2">
                    <Avatar name={p.user.full_name} url={p.user.avatar_url} size={32} />
                    <span className="font-medium">{p.user.full_name}</span>
                  </div>
                  <Button size="sm" onClick={() => assignTreasurer(p.user_id)}>
                    Tornar tesoureiro
                  </Button>
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-sm text-slate-500">Aguardando o organizador definir o tesoureiro.</p>
          )}
        </Card>
      )}

      {/* ETAPA 2 e 3 — Pix + pagamentos */}
      {event.status !== 'voting' && (
        <>
          <TreasurerPixCard
            event={event}
            isTreasurer={isTreasurer}
            treasurer={participants.find((p) => p.user_id === event.treasurer_id)?.user ?? null}
            perPerson={perPerson}
            defaultPixKey={myProfile?.default_pix_key ?? ''}
          />

          <PaymentStatusCard
            participants={participants}
            currentUserId={user?.id ?? ''}
            treasurerId={event.treasurer_id}
            isTreasurer={isTreasurer}
            finished={event.status === 'finished'}
            canAssignTreasurer={canAssignTreasurer}
            onMarkPaid={markAsPaid}
            onConfirm={confirmReceipt}
            onAssignTreasurer={assignTreasurer}
          />

          {event.status === 'collecting' && (isCreator || isTreasurer) && (
            <Button variant="secondary" className="w-full" onClick={finishEvent}>
              <CheckCheck className="h-4 w-4" />
              Finalizar evento
            </Button>
          )}
        </>
      )}

      {/* Chat */}
      {me && <EventChat eventId={event.id} currentUserId={user?.id ?? ''} profiles={profilesById} />}
    </div>
  );
}

/* ===================================================================== *
 * Votação
 * ===================================================================== */
function VotingCard({
  participants,
  voteCounts,
  myVote,
  canVote,
  isCreator,
  onVote,
  onClose,
}: {
  participants: ParticipantWithProfile[];
  voteCounts: Map<string, number>;
  myVote: string | null;
  canVote: boolean;
  isCreator: boolean;
  onVote: (userId: string) => void;
  onClose: () => void;
}) {
  return (
    <Card className="space-y-4">
      <div className="flex items-center gap-2">
        <Vote className="h-5 w-5 text-brand-600" />
        <h2 className="font-semibold">Vote no tesoureiro</h2>
      </div>
      <p className="text-sm text-slate-500">Escolha quem vai guardar o dinheiro e receber os Pix.</p>

      <ul className="space-y-2">
        {participants.map((p) => {
          const votes = voteCounts.get(p.user_id) ?? 0;
          const isMyVote = myVote === p.user_id;
          return (
            <li
              key={p.id}
              className={`flex items-center justify-between rounded-xl border p-3 transition ${
                isMyVote ? 'border-brand-400 bg-brand-50' : 'border-slate-200'
              }`}
            >
              <div className="flex items-center gap-2">
                <Avatar name={p.user.full_name} url={p.user.avatar_url} size={32} />
                <span className="font-medium">{p.user.full_name}</span>
                <span className="rounded-full bg-slate-100 px-2 py-0.5 text-xs text-slate-600">
                  {votes} voto(s)
                </span>
              </div>
              <Button
                size="sm"
                variant={isMyVote ? 'primary' : 'secondary'}
                onClick={() => onVote(p.user_id)}
                disabled={!canVote}
              >
                {isMyVote ? (
                  <>
                    <Check className="h-4 w-4" /> Meu voto
                  </>
                ) : (
                  'Votar'
                )}
              </Button>
            </li>
          );
        })}
      </ul>

      {isCreator && (
        <div className="border-t border-slate-200 pt-4">
          <Button onClick={onClose} className="w-full">
            <Trophy className="h-4 w-4" />
            Encerrar votação e eleger tesoureiro
          </Button>
        </div>
      )}
    </Card>
  );
}

/* ===================================================================== *
 * Tesoureiro / chave Pix
 * ===================================================================== */
function TreasurerPixCard({
  event,
  isTreasurer,
  treasurer,
  perPerson,
  defaultPixKey,
}: {
  event: EventRow;
  isTreasurer: boolean;
  treasurer: PublicProfile | null;
  perPerson: number;
  defaultPixKey: string;
}) {
  const [pixInput, setPixInput] = useState(event.treasurer_pix_key ?? defaultPixKey);
  const [saving, setSaving] = useState(false);
  const [copied, setCopied] = useState(false);

  async function savePix(e: FormEvent) {
    e.preventDefault();
    setSaving(true);
    await supabase
      .from('events')
      .update({ treasurer_pix_key: pixInput.trim() })
      .eq('id', event.id);
    setSaving(false);
  }

  async function copyPix() {
    if (!event.treasurer_pix_key) return;
    await navigator.clipboard.writeText(event.treasurer_pix_key);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  }

  return (
    <Card className="space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Avatar name={treasurer?.full_name ?? '—'} url={treasurer?.avatar_url} size={40} />
          <div>
            <p className="flex items-center gap-1 text-xs uppercase tracking-wide text-slate-400">
              <Crown className="h-3.5 w-3.5 text-amber-500" /> Tesoureiro
            </p>
            <p className="font-semibold">{treasurer?.full_name ?? '—'}</p>
          </div>
        </div>
        <div className="text-right">
          <p className="text-xs uppercase tracking-wide text-slate-400">Cada um paga</p>
          <p className="text-xl font-extrabold text-brand-700">{formatCurrency(perPerson)}</p>
        </div>
      </div>

      <div className="border-t border-slate-200 pt-4">
        {isTreasurer ? (
          <form onSubmit={savePix} className="space-y-3">
            <Input
              label="Sua chave Pix"
              placeholder="CPF, e-mail, telefone ou chave aleatória"
              value={pixInput}
              onChange={(e) => setPixInput(e.target.value)}
              hint="Os participantes vão usar esta chave para te pagar."
            />
            <Button type="submit" loading={saving} variant="secondary" size="sm">
              <KeyRound className="h-4 w-4" />
              Salvar chave Pix
            </Button>
          </form>
        ) : event.treasurer_pix_key ? (
          <div className="flex items-center justify-between rounded-xl bg-slate-50 p-3">
            <div className="min-w-0">
              <p className="text-xs text-slate-400">Chave Pix para pagamento</p>
              <p className="truncate font-mono text-sm">{event.treasurer_pix_key}</p>
            </div>
            <Button size="sm" variant="secondary" onClick={copyPix}>
              {copied ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
              {copied ? 'Copiado' : 'Copiar'}
            </Button>
          </div>
        ) : (
          <p className="text-sm text-slate-500">O tesoureiro ainda não cadastrou a chave Pix.</p>
        )}
      </div>
    </Card>
  );
}

/* ===================================================================== *
 * Status de pagamento (Realtime) + progresso
 * ===================================================================== */
function PaymentStatusCard({
  participants,
  currentUserId,
  treasurerId,
  isTreasurer,
  finished,
  canAssignTreasurer,
  onMarkPaid,
  onConfirm,
  onAssignTreasurer,
}: {
  participants: ParticipantWithProfile[];
  currentUserId: string;
  treasurerId: string | null;
  isTreasurer: boolean;
  finished: boolean;
  canAssignTreasurer: boolean;
  onMarkPaid: () => void;
  onConfirm: (participantId: string) => void;
  onAssignTreasurer: (userId: string) => void;
}) {
  const confirmed = participants.filter((p) => p.payment_status === 'confirmed').length;
  const total = participants.length || 1;
  const pct = Math.round((confirmed / total) * 100);

  return (
    <Card className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="flex items-center gap-2 font-semibold">
          <HandCoins className="h-4 w-4 text-slate-500" />
          Quem já pagou
        </h2>
        <span className="text-sm font-medium text-slate-500">
          {confirmed}/{total} pagos
        </span>
      </div>

      {/* Barra de progresso */}
      <div className="h-2 w-full overflow-hidden rounded-full bg-slate-100">
        <div
          className="h-full rounded-full bg-brand-500 transition-all duration-500"
          style={{ width: `${pct}%` }}
        />
      </div>

      <ul className="space-y-2">
        {participants.map((p) => {
          const isMe = p.user_id === currentUserId;
          const isThisTreasurer = p.user_id === treasurerId;

          return (
            <li
              key={p.id}
              className="flex items-center justify-between gap-2 rounded-xl border border-slate-200 p-3"
            >
              <div className="flex min-w-0 items-center gap-2">
                <Avatar name={p.user.full_name} url={p.user.avatar_url} size={32} />
                <span className="truncate font-medium">{p.user.full_name}</span>
                {isThisTreasurer && (
                  <Crown className="h-4 w-4 shrink-0 text-amber-500" aria-label="Tesoureiro" />
                )}
                {isMe && <span className="shrink-0 text-xs text-slate-400">(você)</span>}
              </div>

              <div className="flex shrink-0 items-center gap-2">
                <StatusBadge status={p.payment_status} />

                {!finished && isMe && !isThisTreasurer && p.payment_status === 'pending' && (
                  <Button size="sm" onClick={onMarkPaid}>
                    Já paguei
                  </Button>
                )}

                {!finished &&
                  isTreasurer &&
                  !isThisTreasurer &&
                  p.payment_status === 'paid_unconfirmed' && (
                    <Button size="sm" variant="secondary" onClick={() => onConfirm(p.id)}>
                      <Check className="h-4 w-4" />
                      Confirmar
                    </Button>
                  )}

                {canAssignTreasurer && !isThisTreasurer && (
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() => onAssignTreasurer(p.user_id)}
                    title="Tornar tesoureiro"
                  >
                    <Crown className="h-4 w-4" />
                  </Button>
                )}
              </div>
            </li>
          );
        })}
      </ul>
    </Card>
  );
}
