<script setup lang="ts">
definePageMeta({
  middleware: 'auth'
})

type CorrectionMode = 'minimal' | 'natural' | 'level-adjusted'
type LanguageLevel = 'B1' | 'B2' | 'C1'

interface DiaryEntry {
  id: string
  entry_date: string
  original_text: string
  language_level: LanguageLevel
  correction_mode: CorrectionMode
  analysis_status: string
  created_at: string
}

const { $supabase } = useNuxtApp()

const entries = ref<DiaryEntry[]>([])
const loading = ref(true)
const errorMessage = ref('')

const correctionLabels: Record<CorrectionMode, string> = {
  minimal: 'Nur Fehler',
  natural: 'Natürlicher',
  'level-adjusted': 'An Niveau angepasst'
}

onMounted(() => {
  loadEntries()
})

async function loadEntries() {
  loading.value = true
  errorMessage.value = ''

  try {
    const { data, error } = await $supabase
      .from('diary_entries')
      .select(`
        id,
        entry_date,
        original_text,
        language_level,
        correction_mode,
        analysis_status,
        created_at
      `)
      .order('created_at', { ascending: false })

    if (error) {
      throw error
    }

    entries.value = (data ?? []) as DiaryEntry[]
  } catch (error) {
    errorMessage.value =
      error instanceof Error
        ? error.message
        : 'Die Einträge konnten nicht geladen werden.'
  } finally {
    loading.value = false
  }
}

function formatDate(value: string) {
  return new Intl.DateTimeFormat('de-DE', {
    weekday: 'long',
    day: '2-digit',
    month: 'long',
    year: 'numeric'
  }).format(new Date(`${value}T00:00:00`))
}

function countWords(text: string) {
  const trimmedText = text.trim()
  return trimmedText ? trimmedText.split(/\s+/).length : 0
}
</script>

<template>
  <div class="history-shell">
    <header class="history-topbar">
      <NuxtLink class="history-brand" to="/">
        <span>D</span>

        <span>
          <strong>Deutsch Diary</strong>
          <small>Deine persönlichen Einträge</small>
        </span>
      </NuxtLink>

      <NuxtLink class="new-entry-link" to="/">
        Neuer Eintrag
      </NuxtLink>
    </header>

    <main class="history-content">
      <section class="history-intro">
        <p class="eyebrow">Dein Lernarchiv</p>
        <h1>Meine Einträge</h1>
        <p>
          Hier findest du deine bisherigen Texte, Zielniveaus und
          Korrektureinstellungen.
        </p>
      </section>

      <div v-if="loading" class="history-state" aria-live="polite">
        <span class="loading-dot" aria-hidden="true" />
        Einträge werden geladen …
      </div>

      <div v-else-if="errorMessage" class="history-state error">
        <p>{{ errorMessage }}</p>

        <button type="button" @click="loadEntries">
          Erneut versuchen
        </button>
      </div>

      <section
        v-else-if="entries.length"
        class="entry-list"
        aria-label="Gespeicherte Tagebucheinträge"
      >
        <NuxtLink
  v-for="entry in entries"
  :key="entry.id"
  class="entry-link"
  :to="`/entries/${entry.id}`"
>
  <article class="entry-card">
          <header class="entry-header">
            <div>
              <p class="entry-date">
                {{ formatDate(entry.entry_date) }}
              </p>

              <p class="entry-meta">
                {{ countWords(entry.original_text) }} Wörter
              </p>
            </div>

            <div class="entry-badges">
              <span class="level-badge">
                {{ entry.language_level }}
              </span>

              <span class="mode-badge">
                {{ correctionLabels[entry.correction_mode] }}
              </span>
            </div>
          </header>

          <p class="entry-text">
            {{ entry.original_text }}
          </p>

          <footer class="entry-footer">
  <span>
    {{
      entry.analysis_status === 'completed'
        ? 'Analysiert'
        : entry.analysis_status === 'processing'
          ? 'Wird analysiert'
          : entry.analysis_status === 'failed'
            ? 'Analyse fehlgeschlagen'
            : 'Noch nicht analysiert'
    }}
  </span>

  <strong>Details ansehen →</strong>
</footer>
        </article>
	</NuxtLink>
      </section>

      <section v-else class="empty-state">
        <span class="empty-mark">D</span>
        <h2>Noch keine Einträge</h2>
        <p>
          Schreibe deinen ersten Text und beginne dein persönliches
          Deutsch-Archiv.
        </p>

        <NuxtLink to="/">
          Ersten Eintrag schreiben
        </NuxtLink>
      </section>
    </main>
  </div>
</template>

<style scoped>
.entry-link {
  display: block;
  border-radius: 18px;
  outline: none;
}

.entry-link .entry-card {
  transition:
    transform 160ms ease,
    border-color 160ms ease,
    box-shadow 160ms ease;
}

.entry-link:hover .entry-card,
.entry-link:focus-visible .entry-card {
  transform: translateY(-2px);
  border-color: var(--forest);
  box-shadow: 0 18px 48px rgba(32, 45, 39, 0.12);
}

.entry-footer strong {
  color: var(--forest);
  font-size: 12px;
}
.history-shell {
  min-height: 100vh;
}

.history-topbar {
  display: flex;
  align-items: center;
  justify-content: space-between;
  width: min(980px, calc(100% - 40px));
  margin: 0 auto;
  padding: 28px 0;
}

.history-brand {
  display: inline-flex;
  align-items: center;
  gap: 12px;
}

.history-brand > span:first-child,
.empty-mark {
  display: grid;
  place-items: center;
  border-radius: 50%;
  color: white;
  background: var(--forest);
  font-family: Georgia, serif;
}

.history-brand > span:first-child {
  width: 42px;
  height: 42px;
  font-size: 24px;
}

.history-brand strong,
.history-brand small {
  display: block;
}

.history-brand strong {
  font-family: Georgia, serif;
  font-size: 18px;
}

.history-brand small {
  margin-top: 2px;
  color: var(--muted);
  font-size: 11px;
}

.new-entry-link,
.empty-state a {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  min-height: 44px;
  padding: 0 18px;
  border-radius: 11px;
  color: white;
  background: var(--forest);
  font-weight: 800;
}

.new-entry-link:hover,
.empty-state a:hover {
  background: var(--forest-dark);
}

.history-content {
  width: min(860px, calc(100% - 40px));
  margin: 42px auto 80px;
}

.history-intro {
  margin-bottom: 34px;
}

.history-intro h1 {
  margin-bottom: 14px;
  font-size: clamp(42px, 7vw, 68px);
}

.history-intro > p:last-child {
  max-width: 620px;
  color: var(--muted);
  font-size: 17px;
  line-height: 1.65;
}

.history-state,
.empty-state {
  padding: 48px 32px;
  border: 1px solid var(--line);
  border-radius: 20px;
  background: var(--surface);
  text-align: center;
}

.history-state {
  color: var(--muted);
}

.history-state.error {
  color: #8a2e2e;
  background: #fff8f7;
}

.history-state.error button {
  padding: 10px 16px;
  border: 0;
  border-radius: 10px;
  color: white;
  background: var(--forest);
  font-weight: 700;
}

.loading-dot {
  display: inline-block;
  width: 9px;
  height: 9px;
  margin-right: 8px;
  border-radius: 50%;
  background: var(--gold);
}

.entry-list {
  display: grid;
  gap: 18px;
}

.entry-card {
  overflow: hidden;
  border: 1px solid var(--line);
  border-radius: 18px;
  background: rgba(255, 253, 248, 0.96);
  box-shadow: 0 14px 40px rgba(32, 45, 39, 0.06);
}

.entry-header,
.entry-footer {
  display: flex;
  align-items: center;
  justify-content: space-between;
}

.entry-header {
  gap: 20px;
  padding: 20px 22px;
  border-bottom: 1px solid var(--line);
  background: rgba(219, 232, 223, 0.25);
}

.entry-date {
  margin-bottom: 5px;
  font-weight: 800;
  text-transform: capitalize;
}

.entry-meta {
  margin: 0;
  color: var(--muted);
  font-size: 12px;
}

.entry-badges {
  display: flex;
  flex-wrap: wrap;
  justify-content: flex-end;
  gap: 8px;
}

.level-badge,
.mode-badge {
  padding: 6px 9px;
  border-radius: 999px;
  font-size: 11px;
  font-weight: 800;
}

.level-badge {
  color: white;
  background: var(--forest);
}

.mode-badge {
  color: var(--forest-dark);
  background: var(--sage);
}

.entry-text {
  margin: 0;
  padding: 24px 22px;
  color: var(--ink);
  font-family: Georgia, serif;
  font-size: 19px;
  line-height: 1.7;
  white-space: pre-wrap;
}

.entry-footer {
  padding: 13px 22px;
  border-top: 1px solid var(--line);
  color: var(--muted);
  font-size: 12px;
}

.empty-mark {
  width: 54px;
  height: 54px;
  margin: 0 auto 20px;
  font-size: 28px;
}

.empty-state h2 {
  margin-bottom: 10px;
  font-size: 34px;
}

.empty-state p {
  max-width: 480px;
  margin: 0 auto 24px;
  color: var(--muted);
  line-height: 1.6;
}

@media (max-width: 640px) {
  .history-topbar,
  .entry-header {
    align-items: flex-start;
  }

  .history-brand small {
    display: none;
  }

  .new-entry-link {
    min-height: 40px;
    padding: 0 13px;
    font-size: 13px;
  }

  .entry-header {
    flex-direction: column;
  }

  .entry-badges {
    justify-content: flex-start;
  }
}
</style>