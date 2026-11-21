-- ============================================================
-- Système B : schéma de base de données (Supabase / PostgreSQL)
-- À coller dans Supabase > SQL Editor > New query > Run.
-- Le script peut être relancé sans danger (il ne duplique rien).
-- ============================================================

-- ---------- Table centrale : tout est un « élément » ----------
create table if not exists public.items (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null default auth.uid() references auth.users(id) on delete cascade,

  type        text not null default 'note',   -- note, savoir, recette, film, serie, livre, cadeau, tache, objectif, evenement...
  title       text not null,
  content     text,                           -- description, notes, résumé...
  url         text,
  image_path  text,                           -- chemin dans le stockage (bucket « images »)

  status      text,                           -- À voir / Vu / À faire / Fait...
  rating      smallint check (rating between 1 and 5),
  event_date  date,                           -- échéance, anniversaire, jalon, sortie...
  tags        text[] not null default '{}',   -- étiquettes / mots-clés

  parent_id   uuid references public.items(id) on delete set null,  -- ex. un jalon rattaché à un objectif
  metadata    jsonb not null default '{}'::jsonb,                   -- infos propres à un type (acteurs, temps de cuisson...)
  source      text not null default 'manual', -- manual, capture, instagram, pinterest...

  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

create index if not exists items_user_created_idx on public.items (user_id, created_at desc);
create index if not exists items_user_type_idx    on public.items (user_id, type);
create index if not exists items_tags_idx         on public.items using gin (tags);
create index if not exists items_date_idx         on public.items (user_id, event_date) where event_date is not null;

-- ---------- Mise à jour automatique de updated_at ----------
create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists items_set_updated_at on public.items;
create trigger items_set_updated_at
  before update on public.items
  for each row execute function public.set_updated_at();

-- ---------- Journal pour les trackers (utilisé plus tard) ----------
create table if not exists public.logs (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid not null default auth.uid() references auth.users(id) on delete cascade,
  item_id    uuid references public.items(id) on delete cascade,  -- optionnel : lié à un élément
  tracker    text not null,                                       -- ex. « eau », « sport », « humeur »
  value      numeric,
  note       text,
  logged_at  timestamptz not null default now()
);

create index if not exists logs_user_tracker_idx on public.logs (user_id, tracker, logged_at desc);

-- ---------- Sécurité : chaque ligne n'est visible que par son propriétaire ----------
alter table public.items enable row level security;
alter table public.logs  enable row level security;

drop policy if exists "items_own" on public.items;
create policy "items_own" on public.items
  for all to authenticated
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

drop policy if exists "logs_own" on public.logs;
create policy "logs_own" on public.logs
  for all to authenticated
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

-- ---------- Stockage des images (bucket privé « images ») ----------
insert into storage.buckets (id, name, public)
values ('images', 'images', false)
on conflict (id) do nothing;

drop policy if exists "images_own_select" on storage.objects;
create policy "images_own_select" on storage.objects
  for select to authenticated
  using (bucket_id = 'images' and (storage.foldername(name))[1] = auth.uid()::text);

drop policy if exists "images_own_insert" on storage.objects;
create policy "images_own_insert" on storage.objects
  for insert to authenticated
  with check (bucket_id = 'images' and (storage.foldername(name))[1] = auth.uid()::text);

drop policy if exists "images_own_update" on storage.objects;
create policy "images_own_update" on storage.objects
  for update to authenticated
  using (bucket_id = 'images' and (storage.foldername(name))[1] = auth.uid()::text);

drop policy if exists "images_own_delete" on storage.objects;
create policy "images_own_delete" on storage.objects
  for delete to authenticated
  using (bucket_id = 'images' and (storage.foldername(name))[1] = auth.uid()::text);
