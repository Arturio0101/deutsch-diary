begin;

create or replace function public.save_vocabulary_item(
  p_source_entry_id uuid,
  p_word text,
  p_article text,
  p_part_of_speech text,
  p_translation_russian text,
  p_example_german text
)
returns uuid
language plpgsql
security invoker
set search_path = public, pg_temp
as $$
declare
  v_user_id uuid := (select auth.uid());
  v_article text;
  v_clean_word text;
  v_normalized_key text;
  v_item_id uuid;
begin
  if v_user_id is null then
    raise exception 'Authentication required';
  end if;

  if p_source_entry_id is not null
    and not exists (
      select 1
      from public.diary_entries
      where id = p_source_entry_id
        and user_id = v_user_id
    )
  then
    raise exception 'Diary entry not found';
  end if;

  v_article := nullif(lower(trim(p_article)), '');

  if v_article is not null
    and v_article not in ('der', 'die', 'das')
  then
    raise exception 'Invalid article';
  end if;

  v_clean_word := trim(
    regexp_replace(
      coalesce(p_word, ''),
      '^(der|die|das)[[:space:]]+',
      '',
      'i'
    )
  );

  if v_clean_word = '' then
    raise exception 'Vocabulary word is required';
  end if;

  v_normalized_key := lower(
    concat_ws(' ', v_article, v_clean_word)
  );

  insert into public.vocabulary_items (
    user_id,
    source_entry_id,
    word,
    article,
    part_of_speech,
    translation_russian,
    example_german,
    normalized_key
  )
  values (
    v_user_id,
    p_source_entry_id,
    v_clean_word,
    v_article,
    trim(p_part_of_speech),
    trim(p_translation_russian),
    trim(p_example_german),
    v_normalized_key
  )
  on conflict (user_id, normalized_key)
  do update set
    source_entry_id = excluded.source_entry_id,
    word = excluded.word,
    article = excluded.article,
    part_of_speech = excluded.part_of_speech,
    translation_russian = excluded.translation_russian,
    example_german = excluded.example_german,
    encounter_count = public.vocabulary_items.encounter_count + 1,
    last_seen_at = now(),
    updated_at = now()
  returning id into v_item_id;

  return v_item_id;
end;
$$;

revoke all
  on function public.save_vocabulary_item(uuid, text, text, text, text, text)
  from public;

grant execute
  on function public.save_vocabulary_item(uuid, text, text, text, text, text)
  to authenticated;

commit;