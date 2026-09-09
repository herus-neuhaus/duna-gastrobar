create index if not exists waitlist_entries_preferred_area_idx
  on public.waitlist_entries (preferred_area_id)
  where preferred_area_id is not null;
