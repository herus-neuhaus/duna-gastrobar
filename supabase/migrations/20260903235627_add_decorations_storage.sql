create table public.decorations (
  id uuid primary key default gen_random_uuid(),
  name text not null check (char_length(btrim(name)) between 2 and 100),
  image_path text not null unique,
  image_url text not null,
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.reservations
  add column decoration_id uuid references public.decorations(id) on delete set null;

create index reservations_decoration_id_idx on public.reservations(decoration_id);

alter table public.decorations enable row level security;

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'decorations',
  'decorations',
  true,
  5242880,
  array['image/jpeg', 'image/png', 'image/webp']
)
on conflict (id) do nothing;

create policy "Public can view active decorations"
  on public.decorations for select
  using (active = true);
