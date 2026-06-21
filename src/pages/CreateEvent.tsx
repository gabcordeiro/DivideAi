import { useMemo, useState, type FormEvent, type KeyboardEvent } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { ArrowLeft, Plus, Trash2, Vote, Crown, Sparkles } from 'lucide-react';
import { supabase } from '@/lib/supabaseClient';
import { useAuth } from '@/context/AuthContext';
import { formatCurrency } from '@/lib/format';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Card } from '@/components/ui/Card';
import type { TreasurerMode } from '@/types/database.types';

interface DraftItem {
  key: string; // id local apenas para a key do React
  name: string;
  price: string; // string no input, convertido ao salvar
}

const QUICK_ITEMS = [
  'Carne',
  'Carvão',
  'Cerveja',
  'Refrigerante',
  'Gelo',
  'Pão de alho',
  'Linguiça',
  'Descartáveis',
];

function emptyItem(): DraftItem {
  return { key: crypto.randomUUID(), name: '', price: '' };
}

export function CreateEvent() {
  const { user } = useAuth();
  const navigate = useNavigate();

  const [title, setTitle] = useState('');
  const [items, setItems] = useState<DraftItem[]>([emptyItem()]);
  const [treasurerMode, setTreasurerMode] = useState<TreasurerMode>('vote');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const total = useMemo(
    () => items.reduce((sum, it) => sum + (parseFloat(it.price) || 0), 0),
    [items],
  );
  const filledCount = items.filter((it) => it.name.trim() && parseFloat(it.price) > 0).length;

  function updateItem(key: string, patch: Partial<DraftItem>) {
    setItems((prev) => prev.map((it) => (it.key === key ? { ...it, ...patch } : it)));
  }

  function addItem() {
    setItems((prev) => [...prev, emptyItem()]);
  }

  function removeItem(key: string) {
    setItems((prev) => (prev.length > 1 ? prev.filter((it) => it.key !== key) : prev));
  }

  function addQuickItem(name: string) {
    setItems((prev) => {
      const blank = prev.find((it) => !it.name.trim() && !it.price.trim());
      if (blank) return prev.map((it) => (it.key === blank.key ? { ...it, name } : it));
      return [...prev, { key: crypto.randomUUID(), name, price: '' }];
    });
  }

  function handlePriceKeyDown(e: KeyboardEvent<HTMLInputElement>) {
    if (e.key === 'Enter') {
      e.preventDefault();
      addItem();
    }
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    if (!user) return;
    setError(null);

    const validItems = items
      .map((it) => ({ name: it.name.trim(), price: parseFloat(it.price) || 0 }))
      .filter((it) => it.name.length > 0 && it.price > 0);

    if (!title.trim()) return setError('Dê um nome ao evento.');
    if (validItems.length === 0) return setError('Adicione ao menos um item com valor.');

    setLoading(true);
    try {
      const direct = treasurerMode === 'direct';

      // 1) Cria o evento. No modo "Eu defino", o criador já é o tesoureiro
      //    e o evento pula a votação, indo direto para a cobrança.
      const { data: event, error: eventErr } = await supabase
        .from('events')
        .insert({
          title: title.trim(),
          created_by: user.id,
          total_amount: total,
          treasurer_mode: treasurerMode,
          treasurer_id: direct ? user.id : null,
          status: direct ? 'collecting' : 'voting',
        })
        .select()
        .single();
      if (eventErr) throw eventErr;

      // 2) Itens.
      const { error: itemsErr } = await supabase
        .from('items')
        .insert(validItems.map((it) => ({ ...it, event_id: event.id })));
      if (itemsErr) throw itemsErr;

      // 3) Criador entra como participante.
      const { error: partErr } = await supabase
        .from('participants')
        .insert({ event_id: event.id, user_id: user.id });
      if (partErr) throw partErr;

      // 4) No modo direto, o tesoureiro (criador) já entra como confirmado.
      if (direct) {
        await supabase
          .from('participants')
          .update({ payment_status: 'confirmed' })
          .eq('event_id', event.id)
          .eq('user_id', user.id);
      }

      navigate(`/events/${event.id}`, { replace: true });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erro ao criar o evento.');
      setLoading(false);
    }
  }

  return (
    <div className="space-y-6">
      <Link
        to="/"
        className="inline-flex items-center gap-1.5 text-sm font-medium text-slate-500 hover:text-slate-800"
      >
        <ArrowLeft className="h-4 w-4" />
        Voltar
      </Link>

      <div>
        <h1 className="text-2xl font-extrabold">Novo evento</h1>
        <p className="text-sm text-slate-500">Liste o que vai ser comprado e o valor estimado.</p>
      </div>

      <form onSubmit={handleSubmit} className="space-y-6">
        <Card>
          <Input
            label="Nome do evento"
            placeholder="Ex: Churrasco de fim de ano"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            required
          />
        </Card>

        {/* Itens */}
        <Card className="space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="flex items-center gap-2 font-semibold">
              Itens
              {filledCount > 0 && (
                <span className="rounded-full bg-brand-100 px-2 py-0.5 text-xs font-semibold text-brand-700">
                  {filledCount}
                </span>
              )}
            </h2>
            <Button type="button" variant="secondary" size="sm" onClick={addItem}>
              <Plus className="h-4 w-4" />
              Adicionar
            </Button>
          </div>

          {/* Chips de itens comuns */}
          <div className="flex flex-wrap gap-2">
            <span className="flex items-center gap-1 text-xs text-slate-400">
              <Sparkles className="h-3.5 w-3.5" /> Rápido:
            </span>
            {QUICK_ITEMS.map((name) => (
              <button
                key={name}
                type="button"
                onClick={() => addQuickItem(name)}
                className="rounded-full border border-slate-200 bg-slate-50 px-3 py-1 text-xs font-medium text-slate-600 transition hover:border-brand-300 hover:bg-brand-50 hover:text-brand-700"
              >
                + {name}
              </button>
            ))}
          </div>

          <div className="space-y-3">
            {items.map((item) => (
              <div key={item.key} className="flex items-end gap-2">
                <div className="flex-1">
                  <Input
                    label="Produto"
                    placeholder="1kg de picanha"
                    value={item.name}
                    onChange={(e) => updateItem(item.key, { name: e.target.value })}
                  />
                </div>
                <div className="w-32">
                  <Input
                    label="Valor (R$)"
                    type="number"
                    min="0"
                    step="0.01"
                    placeholder="0,00"
                    value={item.price}
                    onChange={(e) => updateItem(item.key, { price: e.target.value })}
                    onKeyDown={handlePriceKeyDown}
                  />
                </div>
                <Button
                  type="button"
                  variant="ghost"
                  size="md"
                  onClick={() => removeItem(item.key)}
                  aria-label="Remover item"
                  disabled={items.length === 1}
                  className="mb-0.5 text-slate-400 hover:text-red-600"
                >
                  <Trash2 className="h-4 w-4" />
                </Button>
              </div>
            ))}
          </div>
          <p className="text-xs text-slate-400">Dica: aperte Enter no valor para abrir outro item.</p>

          <div className="flex items-center justify-between border-t border-slate-200 pt-4">
            <span className="text-sm font-medium text-slate-500">Total estimado</span>
            <span className="text-2xl font-extrabold text-brand-700">{formatCurrency(total)}</span>
          </div>
        </Card>

        {/* Modo do tesoureiro */}
        <Card className="space-y-3">
          <h2 className="font-semibold">Quem vai guardar o dinheiro?</h2>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <ModeOption
              active={treasurerMode === 'vote'}
              onClick={() => setTreasurerMode('vote')}
              icon={<Vote className="h-5 w-5" />}
              title="A galera vota"
              description="Os participantes votam em quem será o tesoureiro."
            />
            <ModeOption
              active={treasurerMode === 'direct'}
              onClick={() => setTreasurerMode('direct')}
              icon={<Crown className="h-5 w-5" />}
              title="Eu defino"
              description="Você já entra como tesoureiro (pode trocar depois)."
            />
          </div>
        </Card>

        {error && <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>}

        <Button type="submit" size="lg" loading={loading} className="w-full">
          Criar evento
        </Button>
      </form>
    </div>
  );
}

function ModeOption({
  active,
  onClick,
  icon,
  title,
  description,
}: {
  active: boolean;
  onClick: () => void;
  icon: React.ReactNode;
  title: string;
  description: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`flex items-start gap-3 rounded-xl border p-3 text-left transition ${
        active
          ? 'border-brand-500 bg-brand-50 ring-2 ring-brand-200'
          : 'border-slate-200 hover:border-slate-300'
      }`}
    >
      <span
        className={`mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-lg ${
          active ? 'bg-brand-600 text-white' : 'bg-slate-100 text-slate-500'
        }`}
      >
        {icon}
      </span>
      <span>
        <span className="block font-semibold">{title}</span>
        <span className="block text-xs text-slate-500">{description}</span>
      </span>
    </button>
  );
}
