import { useMemo, useState, type FormEvent } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { ArrowLeft, Plus, Trash2 } from 'lucide-react';
import { supabase } from '@/lib/supabaseClient';
import { useAuth } from '@/context/AuthContext';
import { formatCurrency } from '@/lib/format';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Card } from '@/components/ui/Card';

interface DraftItem {
  /** id local apenas para a key do React */
  key: string;
  name: string;
  price: string; // mantemos como string no input e convertemos ao salvar
}

function emptyItem(): DraftItem {
  return { key: crypto.randomUUID(), name: '', price: '' };
}

export function CreateEvent() {
  const { user } = useAuth();
  const navigate = useNavigate();

  const [title, setTitle] = useState('');
  const [items, setItems] = useState<DraftItem[]>([emptyItem()]);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const total = useMemo(
    () => items.reduce((sum, it) => sum + (parseFloat(it.price) || 0), 0),
    [items],
  );

  function updateItem(key: string, patch: Partial<DraftItem>) {
    setItems((prev) => prev.map((it) => (it.key === key ? { ...it, ...patch } : it)));
  }

  function addItem() {
    setItems((prev) => [...prev, emptyItem()]);
  }

  function removeItem(key: string) {
    setItems((prev) => (prev.length > 1 ? prev.filter((it) => it.key !== key) : prev));
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
      // 1) Cria o evento (status inicial = votação do tesoureiro).
      const { data: event, error: eventErr } = await supabase
        .from('events')
        .insert({
          title: title.trim(),
          created_by: user.id,
          total_amount: total,
          status: 'voting',
        })
        .select()
        .single();
      if (eventErr) throw eventErr;

      // 2) Insere os itens do evento.
      const { error: itemsErr } = await supabase
        .from('items')
        .insert(validItems.map((it) => ({ ...it, event_id: event.id })));
      if (itemsErr) throw itemsErr;

      // 3) Adiciona o criador como participante do evento.
      const { error: partErr } = await supabase
        .from('participants')
        .insert({ event_id: event.id, user_id: user.id });
      if (partErr) throw partErr;

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

        <Card className="space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="font-semibold">Itens</h2>
            <Button type="button" variant="secondary" size="sm" onClick={addItem}>
              <Plus className="h-4 w-4" />
              Adicionar item
            </Button>
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

          <div className="flex items-center justify-between border-t border-slate-200 pt-4">
            <span className="text-sm font-medium text-slate-500">Total estimado</span>
            <span className="text-xl font-extrabold text-brand-700">
              {formatCurrency(total)}
            </span>
          </div>
        </Card>

        {error && (
          <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>
        )}

        <Button type="submit" size="lg" loading={loading} className="w-full">
          Criar evento
        </Button>
      </form>
    </div>
  );
}
