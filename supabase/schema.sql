-- =============================================================================
-- Divide Aí — Schema completo do Supabase
-- Rode este script no Supabase Dashboard > SQL Editor.
-- É idempotente o suficiente para rodar em um projeto novo.
-- =============================================================================

-- -----------------------------------------------------------------------------
-- 1. TABELAS
-- -----------------------------------------------------------------------------

-- Perfil público do usuário (1:1 com auth.users).
create table if not exists public.users (
  id              uuid primary key references auth.users (id) on delete cascade,
  full_name       text not null,
  default_pix_key text,
  created_at      timestamptz not null default now()
);

-- Eventos (viagens, festas, churrascos...).
create table if not exists public.events (
  id                uuid primary key default gen_random_uuid(),
  title             text not null,
  created_by        uuid not null references public.users (id) on delete cascade,
  total_amount      numeric(12, 2) not null default 0,
  treasurer_id      uuid references public.users (id) on delete set null,
  treasurer_pix_key text,
  status            text not null default 'voting'
                      check (status in ('voting', 'collecting', 'finished')),
  created_at        timestamptz not null default now()
);

-- Itens que serão comprados no evento.
create table if not exists public.items (
  id         uuid primary key default gen_random_uuid(),
  event_id   uuid not null references public.events (id) on delete cascade,
  name       text not null,
  price      numeric(12, 2) not null default 0 check (price >= 0),
  created_at timestamptz not null default now()
);

-- Participantes do evento (com voto e status de pagamento).
create table if not exists public.participants (
  id             uuid primary key default gen_random_uuid(),
  event_id       uuid not null references public.events (id) on delete cascade,
  user_id        uuid not null references public.users (id) on delete cascade,
  voted_for_id   uuid references public.users (id) on delete set null,
  payment_status text not null default 'pending'
                   check (payment_status in ('pending', 'paid_unconfirmed', 'confirmed')),
  created_at     timestamptz not null default now(),
  -- Um usuário só participa uma vez de cada evento.
  unique (event_id, user_id)
);

-- Índices úteis para os filtros mais comuns.
create index if not exists idx_items_event_id        on public.items (event_id);
create index if not exists idx_participants_event_id on public.participants (event_id);
create index if not exists idx_participants_user_id  on public.participants (user_id);


-- -----------------------------------------------------------------------------
-- 2. FUNÇÕES AUXILIARES (SECURITY DEFINER)
--    Usadas nas policies para evitar recursão infinita de RLS:
--    elas leem as tabelas IGNORANDO o RLS (definer), então uma policy de
--    `participants` pode consultar `participants` sem se auto-disparar.
-- -----------------------------------------------------------------------------

create or replace function public.is_event_participant(p_event_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.participants
    where event_id = p_event_id
      and user_id = auth.uid()
  );
$$;

create or replace function public.is_event_treasurer(p_event_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.events
    where id = p_event_id
      and treasurer_id = auth.uid()
  );
$$;


-- -----------------------------------------------------------------------------
-- 3. TRIGGERS
-- -----------------------------------------------------------------------------

-- 3a. Cria automaticamente o perfil em public.users quando alguém se cadastra.
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.users (id, full_name)
  values (
    new.id,
    coalesce(new.raw_user_meta_data ->> 'full_name', split_part(new.email, '@', 1))
  )
  on conflict (id) do nothing;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- 3b. Mantém events.total_amount sincronizado com a soma dos itens.
create or replace function public.recalc_event_total()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_event_id uuid := coalesce(new.event_id, old.event_id);
begin
  update public.events e
  set total_amount = coalesce(
    (select sum(price) from public.items where event_id = v_event_id), 0
  )
  where e.id = v_event_id;
  return null;
end;
$$;

drop trigger if exists trg_items_recalc_total on public.items;
create trigger trg_items_recalc_total
  after insert or update or delete on public.items
  for each row execute function public.recalc_event_total();

-- 3c. Ao eleger o tesoureiro, marca o pagamento dele como confirmado
--     (ele guarda o dinheiro, não deve a si mesmo). SECURITY DEFINER para
--     poder atualizar a linha do tesoureiro mesmo quando quem encerra a
--     votação é o criador (e não o próprio tesoureiro).
create or replace function public.confirm_treasurer_payment()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.treasurer_id is not null
     and (old.treasurer_id is distinct from new.treasurer_id) then
    update public.participants
    set payment_status = 'confirmed'
    where event_id = new.id
      and user_id = new.treasurer_id;
  end if;
  return new;
end;
$$;

drop trigger if exists trg_confirm_treasurer on public.events;
create trigger trg_confirm_treasurer
  after update on public.events
  for each row execute function public.confirm_treasurer_payment();


-- -----------------------------------------------------------------------------
-- 4. ROW LEVEL SECURITY
-- -----------------------------------------------------------------------------

alter table public.users        enable row level security;
alter table public.events       enable row level security;
alter table public.items        enable row level security;
alter table public.participants enable row level security;

-- ---- USERS -----------------------------------------------------------------
-- Qualquer usuário autenticado pode ler perfis (para exibir nomes na votação/lista).
drop policy if exists "users_select_authenticated" on public.users;
create policy "users_select_authenticated"
  on public.users for select
  to authenticated
  using (true);

-- Cada um só edita o próprio perfil.
drop policy if exists "users_update_self" on public.users;
create policy "users_update_self"
  on public.users for update
  to authenticated
  using (id = auth.uid())
  with check (id = auth.uid());

-- Inserção do próprio perfil (fallback; normalmente o trigger já cria).
drop policy if exists "users_insert_self" on public.users;
create policy "users_insert_self"
  on public.users for insert
  to authenticated
  with check (id = auth.uid());

-- ---- EVENTS ----------------------------------------------------------------
-- Vê o evento quem é criador ou participante.
drop policy if exists "events_select_member" on public.events;
create policy "events_select_member"
  on public.events for select
  to authenticated
  using (created_by = auth.uid() or public.is_event_participant(id));

-- Cria evento em nome próprio.
drop policy if exists "events_insert_own" on public.events;
create policy "events_insert_own"
  on public.events for insert
  to authenticated
  with check (created_by = auth.uid());

-- Atualiza quem é criador (gerencia o evento) ou tesoureiro (define a chave Pix).
drop policy if exists "events_update_admin" on public.events;
create policy "events_update_admin"
  on public.events for update
  to authenticated
  using (created_by = auth.uid() or treasurer_id = auth.uid())
  with check (created_by = auth.uid() or treasurer_id = auth.uid());

-- Apaga só o criador.
drop policy if exists "events_delete_owner" on public.events;
create policy "events_delete_owner"
  on public.events for delete
  to authenticated
  using (created_by = auth.uid());

-- ---- ITEMS -----------------------------------------------------------------
-- Participantes do evento veem os itens.
drop policy if exists "items_select_member" on public.items;
create policy "items_select_member"
  on public.items for select
  to authenticated
  using (public.is_event_participant(event_id));

-- Só o criador do evento gerencia os itens.
drop policy if exists "items_write_owner" on public.items;
create policy "items_write_owner"
  on public.items for all
  to authenticated
  using (
    exists (select 1 from public.events e where e.id = event_id and e.created_by = auth.uid())
  )
  with check (
    exists (select 1 from public.events e where e.id = event_id and e.created_by = auth.uid())
  );

-- ---- PARTICIPANTS ----------------------------------------------------------
-- Vê a lista de participantes quem participa do mesmo evento.
drop policy if exists "participants_select_member" on public.participants;
create policy "participants_select_member"
  on public.participants for select
  to authenticated
  using (public.is_event_participant(event_id));

-- Usuário entra no evento por conta própria (insere a si mesmo).
drop policy if exists "participants_insert_self" on public.participants;
create policy "participants_insert_self"
  on public.participants for insert
  to authenticated
  with check (user_id = auth.uid());

-- Usuário atualiza a PRÓPRIA linha (voto, "já paguei").
-- O tesoureiro também pode atualizar (confirmar recebimento dos demais).
drop policy if exists "participants_update_self_or_treasurer" on public.participants;
create policy "participants_update_self_or_treasurer"
  on public.participants for update
  to authenticated
  using (user_id = auth.uid() or public.is_event_treasurer(event_id))
  with check (user_id = auth.uid() or public.is_event_treasurer(event_id));

-- Usuário pode sair do evento (apaga a própria linha).
drop policy if exists "participants_delete_self" on public.participants;
create policy "participants_delete_self"
  on public.participants for delete
  to authenticated
  using (user_id = auth.uid());


-- -----------------------------------------------------------------------------
-- 5. REALTIME
--    Publica as tabelas que o front escuta via supabase.channel().
-- -----------------------------------------------------------------------------

alter publication supabase_realtime add table public.events;
alter publication supabase_realtime add table public.items;
alter publication supabase_realtime add table public.participants;

-- Garante que o payload de UPDATE/DELETE traga a linha antiga (útil em filtros).
alter table public.events       replica identity full;
alter table public.items        replica identity full;
alter table public.participants replica identity full;
