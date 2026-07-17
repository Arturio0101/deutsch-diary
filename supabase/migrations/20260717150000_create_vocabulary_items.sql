begin;

create table public.vocabulary_items (
  id uuid primary key default gen_random_uuid(),

  user_id uuid not null
    default auth.uid()
    references auth.users(id)
    on delete cascade,

  source_entry_id uuid
    references public.diary_entries(id)
    on delete set null,

  word text not null,
  article text,
  part_of_speech text not null,
  translation_russian text not null,
  example_german text not null,

  normalized_key text not null,

  encounter_count integer not null default 1
    check (encounter_count > 0),

  review_count integer not null default 0
    check (review_count >= 0),

  next_review_at timestamptz,
  last_seen_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  constraint vocabulary_items_word_not_empty
    check (char_length(trim(word)) > 0),

  constraint vocabulary_items_normalized_key_not_empty
    check (char_length(trim(normalized_key)) > 0),

  constraint vocabulary_items_article_allowed
    check (
      article is null
      or article in ('der', 'die', 'das')
    ),

  constraint vocabulary_items_user_word_unique
    unique (user_id, normalized_key)
);

create index vocabulary_items_user_created_at_idx
  on public.vocabulary_items (user_id, created_at desc);

create index vocabulary_items_user_next_review_idx
  on public.vocabulary_items (user_id, next_review_at);

alter table public.vocabulary_items enable row level security;

create policy "Users can view their own vocabulary"
  on public.vocabulary_items
  for select
  to authenticated
  using ((select auth.uid()) = user_id);

create policy "Users can create their own vocabulary"
  on public.vocabulary_items
  for insert
  to authenticated
  with check ((select auth.uid()) = user_id);

create policy "Users can update their own vocabulary"
  on public.vocabulary_items
  for update
  to authenticated
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);

create policy "Users can delete their own vocabulary"
  on public.vocabulary_items
  for delete
  to authenticated
  using ((select auth.uid()) = user_id);

grant select, insert, update, delete
  on public.vocabulary_items
  to authenticated;

commit;