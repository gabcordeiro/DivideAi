import { useEffect, useState, useCallback } from 'react';
import { Link } from 'react-router-dom';
import { Plus, Users, ChevronRight, PartyPopper } from 'lucide-react';
import { supabase } from '@/lib/supabaseClient';
import { useAuth } from '@/context/AuthContext';
import { formatCurrency } from '@/lib/format';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { Spinner } from '@/components/ui/Spinner';
import type { EventRow, EventStatus } from '@/types/database.types';

const statusLabels: Record<EventStatus, string> = {
  voting: 'Votação do tesoureiro',
  collecting: 'Coletando pagamentos',
  finished: 'Finalizado',
};

const statusColors: Record<EventStatus, string> = {
  voting: 'bg-amber-100 text-amber-800',
  collecting: 'bg-blue-100 text-blue-800',
  finished: 'bg-slate-100 text-slate-600',
};

export function Dashboard() {
  const { user } = useAuth();
  const [events, setEvents] = useState<EventRow[]>([]);
  const [loading, setLoading] = useState(true);

  const loadEvents = useCallback(async () => {
    if (!user) return;
    // Busca os eventos em que o usuário é participante (creator entra como participante).
    const { data, error } = await supabase
      .from('participants')
      .select('event:events(*)')
      .eq('user_id', user.id)
      .order('created_at', { ascending: false })
      .returns<{ event: EventRow | null }[]>();

    if (error) {
      console.error('Erro ao carregar eventos:', error.message);
      setLoading(false);
      return;
    }

    const list = (data ?? [])
      .map((row) => row.event)
      .filter((e): e is EventRow => e !== null);

    setEvents(list);
    setLoading(false);
  }, [user]);

  useEffect(() => {
    loadEvents();
  }, [loadEvents]);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-extrabold">Seus eventos</h1>
          <p className="text-sm text-slate-500">Tudo que você está rachando.</p>
        </div>
        <Link to="/events/new">
          <Button>
            <Plus className="h-4 w-4" />
            Novo evento
          </Button>
        </Link>
      </div>

      {loading ? (
        <Spinner label="Carregando eventos…" />
      ) : events.length === 0 ? (
        <Card className="flex flex-col items-center gap-3 py-12 text-center">
          <PartyPopper className="h-10 w-10 text-brand-500" />
          <div>
            <p className="font-semibold">Nenhum evento ainda</p>
            <p className="text-sm text-slate-500">
              Crie seu primeiro evento e convide a galera.
            </p>
          </div>
          <Link to="/events/new">
            <Button>
              <Plus className="h-4 w-4" />
              Criar evento
            </Button>
          </Link>
        </Card>
      ) : (
        <div className="space-y-3">
          {events.map((event) => (
            <Link key={event.id} to={`/events/${event.id}`}>
              <Card className="flex items-center justify-between transition hover:border-brand-300 hover:shadow-md">
                <div className="min-w-0">
                  <div className="flex items-center gap-2">
                    <h2 className="truncate font-semibold">{event.title}</h2>
                    <span
                      className={`rounded-full px-2 py-0.5 text-xs font-medium ${statusColors[event.status]}`}
                    >
                      {statusLabels[event.status]}
                    </span>
                  </div>
                  <p className="mt-1 flex items-center gap-1.5 text-sm text-slate-500">
                    <Users className="h-3.5 w-3.5" />
                    Total {formatCurrency(event.total_amount)}
                  </p>
                </div>
                <ChevronRight className="h-5 w-5 shrink-0 text-slate-400" />
              </Card>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
