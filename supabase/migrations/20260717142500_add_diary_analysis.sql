begin;

alter table public.diary_entries
  add column feedback_russian text,
  add column corrections jsonb not null default '[]'::jsonb,
  add column vocabulary jsonb not null default '[]'::jsonb;

alter table public.diary_entries
  add constraint diary_entries_feedback_length
    check (
      feedback_russian is null
      or char_length(feedback_russian) <= 4000
    ),

  add constraint diary_entries_corrections_array
    check (jsonb_typeof(corrections) = 'array'),

  add constraint diary_entries_vocabulary_array
    check (jsonb_typeof(vocabulary) = 'array');

commit;