begin;

alter table public.diary_entries
  add column if not exists client_id uuid;

create unique index if not exists
  diary_entries_user_client_id_unique
on public.diary_entries (
  user_id,
  client_id
);

comment on column public.diary_entries.client_id is
  'Permanent identifier generated on the client for safe offline synchronization.';

commit;