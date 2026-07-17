<script setup lang="ts">
definePageMeta({
  middleware: 'auth'
})

interface VocabularyItem {
  id: string
  source_entry_id: string | null
  word: string
  article: 'der' | 'die' | 'das' | null
  part_of_speech: string
  translation_russian: string
  example_german: string
  encounter_count: number
  review_count: number
  last_seen_at: string
  created_at: string
}

type SortMode = 'recent' | 'frequent' | 'alphabetical'

const { $supabase } = useNuxtApp()

const vocabulary = ref<VocabularyItem[]>([])
const loading = ref(true)
const loadError = ref('')
const searchQuery = ref('')
const sortMode = ref<SortMode>('recent')
const deletingId = ref<string | null>(null)

const filteredVocabulary = computed(() => {
  const query = searchQuery.value.trim().toLocaleLowerCase('de-DE')

  const items = query
    ? vocabulary.value.filter((item) => {
        const searchableText = [
          item.word,
          item.article,
          item.part_of_speech,
          item.translation_russian,
          item.example_german
        ]
          .filter(Boolean)
          .join(' ')
          .toLocaleLowerCase('de-DE')

        return searchableText.includes(query)
      })
    : [...vocabulary.value]

  if (sortMode.value === 'frequent') {
    return items.sort(
      (first, second) =>
        second.encounter_count - first.encounter_count
    )
  }

  if (sortMode.value === 'alphabetical') {
    return items.sort((first, second) =>
      wordLabel(first).localeCompare(
        wordLabel(second),
        'de',
        { sensitivity: 'base' }
      )
    )
  }

  return items.sort(
    (first, second) =>
      new Date(second.last_seen_at).getTime() -
      new Date(first.last_seen_at).getTime()
  )
})

const totalEncounters = computed(() =>
  vocabulary.value.reduce(
    (total, item) => total + item.encounter_count,
    0
  )
)

function wordLabel(item: VocabularyItem) {
  const cleanWord = item.word.replace(
    /^(der|die|das)\s+/i,
    ''
  )

  return [item.article, cleanWord]
    .filter(Boolean)
    .join(' ')
}

function formatDate(value: string) {
  return new Intl.DateTimeFormat('de-DE', {
    day: '2-digit',
    month: 'short',
    year: 'numeric'
  }).format(new Date(value))
}

async function loadVocabulary() {
  loading.value = true
  loadError.value = ''

  const { data, error } = await $supabase
    .from('vocabulary_items')
    .select(`
      id,
      source_entry_id,
      word,
      article,
      part_of_speech,
      translation_russian,
      example_german,
      encounter_count,
      review_count,
      last_seen_at,
      created_at
    `)
    .order('last_seen_at', { ascending: false })

  if (error) {
    loadError.value = 'Der Wortschatz konnte nicht geladen werden.'
    loading.value = false
    return
  }

  vocabulary.value = data ?? []
  loading.value = false
}

async function removeWord(item: VocabularyItem) {
  const confirmed = window.confirm(
    `Möchtest du „${wordLabel(item)}“ wirklich aus deinem Wortschatz entfernen?`
  )

  if (!confirmed) {
    return
  }

  deletingId.value = item.id

  const { error } = await $supabase
    .from('vocabulary_items')
    .delete()
    .eq('id', item.id)

  if (error) {
    loadError.value = 'Das Wort konnte nicht entfernt werden.'
    deletingId.value = null
    return
  }

  vocabulary.value = vocabulary.value.filter(
    (word) => word.id !== item.id
  )

  deletingId.value = null
}

onMounted(loadVocabulary)
</script>

<template>
  <div class="vocabulary-page">
    <header class="vocabulary-topbar">
      <NuxtLink class="brand" to="/">
        <span class="brand-mark">D</span>

        <span>
          <strong>Deutsch Diary</strong>
          <small>Dein persönlicher Wortschatz</small>
        </span>
      </NuxtLink>

      <nav class="topbar-navigation" aria-label="Hauptnavigation">
        <NuxtLink class="navigation-link" to="/entries">
          Meine Einträge
        </NuxtLink>

        <NuxtLink class="new-entry-link" to="/">
          Neuer Eintrag
        </NuxtLink>
      </nav>
    </header>

    <main class="vocabulary-content">
      <section class="vocabulary-intro">
        <p class="eyebrow">Dein persönliches Wörterbuch</p>
        <h1>Mein Wortschatz</h1>

        <p>
          Alle wichtigen Wörter aus deinen Tagebucheinträgen
          an einem Ort.
        </p>
      </section>

      <section class="statistics" aria-label="Wortschatz-Statistik">
        <article>
          <strong>{{ vocabulary.length }}</strong>
          <span>gespeicherte Wörter</span>
        </article>

        <article>
          <strong>{{ totalEncounters }}</strong>
          <span>Begegnungen insgesamt</span>
        </article>
      </section>

      <section class="vocabulary-toolbar">
        <label class="search-field">
          <span class="sr-only">Wortschatz durchsuchen</span>

          <input
            v-model="searchQuery"
            type="search"
            placeholder="Wort oder Übersetzung suchen …"
          >
        </label>

        <label class="sort-field">
          <span>Sortieren</span>

          <select v-model="sortMode">
            <option value="recent">Zuletzt gesehen</option>
            <option value="frequent">Am häufigsten</option>
            <option value="alphabetical">Alphabetisch</option>
          </select>
        </label>
      </section>

      <p
        v-if="loadError"
        class="state-message error"
        role="alert"
      >
        {{ loadError }}
      </p>

      <p v-else-if="loading" class="state-message">
        Wortschatz wird geladen …
      </p>

      <section
        v-else-if="!vocabulary.length"
        class="empty-state"
      >
        <span class="empty-mark">W</span>
        <h2>Dein Wortschatz ist noch leer</h2>

        <p>
          Schreibe einen Tagebucheintrag. Die wichtigsten Wörter
          werden nach der Analyse automatisch hier gespeichert.
        </p>

        <NuxtLink class="new-entry-link" to="/">
          Ersten Eintrag schreiben
        </NuxtLink>
      </section>

      <p
        v-else-if="!filteredVocabulary.length"
        class="state-message"
      >
        Keine Wörter für „{{ searchQuery }}“ gefunden.
      </p>

      <section v-else class="word-grid">
        <article
          v-for="item in filteredVocabulary"
          :key="item.id"
          class="word-card"
        >
          <div class="word-card-heading">
            <div>
              <h2>{{ wordLabel(item) }}</h2>
              <p>{{ item.part_of_speech }}</p>
            </div>

            <span
              v-if="item.encounter_count > 1"
              class="encounter-badge"
              :title="`${item.encounter_count} Mal gesehen`"
            >
              ×{{ item.encounter_count }}
            </span>
          </div>

          <p class="translation">
            {{ item.translation_russian }}
          </p>

          <blockquote>
            {{ item.example_german }}
          </blockquote>

          <footer class="word-card-footer">
            <span>
              Zuletzt gesehen: {{ formatDate(item.last_seen_at) }}
            </span>

            <div class="word-actions">
              <NuxtLink
                v-if="item.source_entry_id"
                :to="`/entries/${item.source_entry_id}`"
              >
                Eintrag ansehen
              </NuxtLink>

              <button
                type="button"
                :disabled="deletingId === item.id"
                @click="removeWord(item)"
              >
                {{ deletingId === item.id ? '…' : 'Entfernen' }}
              </button>
            </div>
          </footer>
        </article>
      </section>
    </main>
  </div>
</template>

<style scoped>
.vocabulary-page {
  min-height: 100vh;
  color: var(--forest-dark);
  background:
    radial-gradient(circle at 85% 12%, rgba(222, 192, 120, 0.15), transparent 30%),
    var(--paper);
}

.vocabulary-topbar {
  display: flex;
  align-items: center;
  justify-content: space-between;
  width: min(1180px, calc(100% - 40px));
  margin: 0 auto;
  padding: 28px 0;
}

.topbar-navigation {
  display: flex;
  align-items: center;
  gap: 10px;
}

.navigation-link,
.new-entry-link {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  min-height: 44px;
  padding: 0 16px;
  border-radius: 12px;
  font-weight: 800;
}

.navigation-link {
  border: 1px solid var(--line);
  color: var(--forest-dark);
  background: var(--surface);
}

.new-entry-link {
  border: 1px solid var(--forest);
  color: white;
  background: var(--forest);
}

.vocabulary-content {
  width: min(1050px, calc(100% - 40px));
  margin: 70px auto 0;
  padding-bottom: 80px;
}

.vocabulary-intro {
  max-width: 720px;
}

.vocabulary-intro h1 {
  margin-bottom: 16px;
  font-size: clamp(54px, 8vw, 82px);
  line-height: 0.95;
}

.vocabulary-intro > p:last-child {
  color: var(--muted);
  font-size: 20px;
  line-height: 1.6;
}

.statistics {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 220px));
  gap: 14px;
  margin: 38px 0 24px;
}

.statistics article {
  padding: 20px;
  border: 1px solid var(--line);
  border-radius: 16px;
  background: var(--surface);
}

.statistics strong {
  display: block;
  margin-bottom: 4px;
  color: var(--forest);
  font-family: Georgia, serif;
  font-size: 32px;
}

.statistics span {
  color: var(--muted);
  font-size: 13px;
}

.vocabulary-toolbar {
  display: grid;
  grid-template-columns: 1fr auto;
  gap: 14px;
  margin-bottom: 24px;
  padding: 16px;
  border: 1px solid var(--line);
  border-radius: 16px;
  background: rgba(219, 232, 223, 0.3);
}

.search-field input,
.sort-field select {
  min-height: 48px;
  border: 1px solid var(--line);
  border-radius: 11px;
  color: var(--forest-dark);
  background: var(--surface);
  font: inherit;
}

.search-field input {
  width: 100%;
  padding: 0 15px;
}

.sort-field {
  display: flex;
  align-items: center;
  gap: 10px;
}

.sort-field span {
  color: var(--muted);
  font-size: 13px;
  font-weight: 700;
}

.sort-field select {
  padding: 0 34px 0 13px;
}

.word-grid {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 16px;
}

.word-card {
  display: flex;
  flex-direction: column;
  min-height: 260px;
  padding: 22px;
  border: 1px solid var(--line);
  border-radius: 18px;
  background: var(--surface);
  box-shadow: 0 15px 40px rgba(32, 45, 39, 0.06);
}

.word-card-heading {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 14px;
}

.word-card-heading h2 {
  margin-bottom: 5px;
  font-family: Georgia, serif;
  font-size: 27px;
}

.word-card-heading p {
  color: var(--forest);
  font-size: 11px;
  font-weight: 800;
  text-transform: uppercase;
}

.encounter-badge {
  display: inline-flex;
  min-width: 38px;
  min-height: 30px;
  align-items: center;
  justify-content: center;
  border-radius: 999px;
  color: var(--forest-dark);
  background: var(--sage);
  font-weight: 800;
}

.translation {
  margin: 22px 0 16px;
  color: var(--muted);
  font-size: 17px;
}

.word-card blockquote {
  margin: 0 0 24px;
  padding: 14px 16px;
  border-left: 3px solid var(--gold);
  color: var(--forest-dark);
  background: #fffaf0;
  line-height: 1.55;
}

.word-card-footer {
  display: flex;
  align-items: flex-end;
  justify-content: space-between;
  gap: 12px;
  margin-top: auto;
  padding-top: 16px;
  border-top: 1px solid var(--line);
}

.word-card-footer > span {
  color: var(--muted);
  font-size: 11px;
}

.word-actions {
  display: flex;
  align-items: center;
  gap: 12px;
}

.word-actions a,
.word-actions button {
  color: var(--forest);
  font-size: 12px;
  font-weight: 800;
}

.word-actions button {
  padding: 0;
  border: 0;
  background: transparent;
  cursor: pointer;
}

.word-actions button:hover {
  color: #9b4a45;
}

.word-actions button:disabled {
  cursor: wait;
  opacity: 0.5;
}

.state-message,
.empty-state {
  padding: 32px;
  border: 1px solid var(--line);
  border-radius: 18px;
  text-align: center;
  background: var(--surface);
}

.state-message.error {
  color: #8a2e2e;
  background: #f8e1df;
}

.empty-state {
  padding: 60px 30px;
}

.empty-mark {
  display: inline-flex;
  width: 58px;
  height: 58px;
  align-items: center;
  justify-content: center;
  margin-bottom: 18px;
  border-radius: 50%;
  color: white;
  background: var(--forest);
  font-family: Georgia, serif;
  font-size: 27px;
}

.empty-state h2 {
  margin-bottom: 10px;
  font-size: 30px;
}

.empty-state p {
  max-width: 560px;
  margin: 0 auto 24px;
  color: var(--muted);
  line-height: 1.6;
}

@media (max-width: 760px) {
  .vocabulary-topbar {
    align-items: flex-start;
  }

  .topbar-navigation {
    flex-direction: column-reverse;
    align-items: stretch;
  }

  .vocabulary-content {
    margin-top: 35px;
  }

  .word-grid {
    grid-template-columns: 1fr;
  }
}

@media (max-width: 600px) {
  .vocabulary-topbar,
  .vocabulary-content {
    width: min(100% - 24px, 1050px);
  }

  .brand small {
    display: none;
  }

  .navigation-link,
  .new-entry-link {
    min-height: 40px;
    padding: 0 11px;
    font-size: 12px;
  }

  .statistics {
    grid-template-columns: 1fr 1fr;
  }

  .vocabulary-toolbar {
    grid-template-columns: 1fr;
  }

  .sort-field {
    justify-content: space-between;
  }

  .sort-field select {
    flex: 1;
  }

  .word-card-footer {
    align-items: flex-start;
    flex-direction: column;
  }
}
</style>