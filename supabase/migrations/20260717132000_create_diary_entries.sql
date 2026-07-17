begin;

create table public.diary_entries (
  id uuid primary key default gen_random_uuid(),

  user_id uuid not null
    default auth.uid()
    references auth.users(id)
    on delete cascade,

  entry_date date not null default current_date,

  original_text text not null,
  corrected_text text,

  language_level text not null default 'B1',
  correction_mode text not null default 'minimal',
  analysis_status text not null default 'draft',

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  constraint diary_entries_original_text_length
    check (char_length(original_text) between 1 and 6000),

  constraint diary_entries_corrected_text_length
    check (
      corrected_text is null
      or char_length(corrected_text) between 1 and 12000
    ),

  constraint diary_entries_language_level
    check (language_level in ('B1', 'B2', 'C1')),

  constraint diary_entries_correction_mode
    check (
      correction_mode in ('minimal', 'natural', 'level-adjusted')
    ),

  constraint diary_entries_analysis_status
    check (
      analysis_status in ('draft', 'processing', 'completed', 'failed')
    )
);

create index diary_entries_user_created_at_idx
  on public.diary_entries (user_id, created_at desc);

create or replace function public.set_updated_at()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create trigger diary_entries_set_updated_at
before update on public.diary_entries
for each row
execute function public.set_updated_at();

alter table public.diary_entries enable row level security;

revoke all on table public.diary_entries from anon;
grant usage on schema public to authenticated;
grant select, insert, update, delete
  on table public.diary_entries
  to authenticated;

create policy "Users can view their own diary entries"
on public.diary_entries
for select
to authenticated
using ((select auth.uid()) = user_id);

create policy "Users can create their own diary entries"
on public.diary_entries
for insert
to authenticated
with check ((select auth.uid()) = user_id);

create policy "Users can update their own diary entries"
on public.diary_entries
for update
to authenticated
using ((select auth.uid()) = user_id)
with check ((select auth.uid()) = user_id);

create policy "Users can delete their own diary entries"
on public.diary_entries
for delete
to authenticated
using ((select auth.uid()) = user_id);

commit;