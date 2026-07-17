<script setup lang="ts">
definePageMeta({
  middleware: 'auth'
})

type LanguageLevel = 'B1' | 'B2' | 'C1'
type CorrectionMode = 'minimal' | 'natural' | 'level-adjusted'

interface Correction {
  original: string
  corrected: string
  explanationRussian: string
}

interface VocabularyItem {
  lemma: string
  article: 'der' | 'die' | 'das' | null
  partOfSpeech: string
  translationRussian: string
  exampleGerman: string
}

interface DiaryEntry {
  id: string
  entry_date: string
  original_text: string
  corrected_text: string | null
  feedback_russian: string | null
  corrections: Correction[]
  vocabulary: VocabularyItem[]
  language_level: LanguageLevel
  correction_mode: CorrectionMode
  analysis_status: string
  created_at: string
}

const route = useRoute()
const { $supabase } = useNuxtApp()

const entry = ref<DiaryEntry | null>(null)
const loading = ref(true)
const errorMessage = ref('')

const correctionLabels: Record<CorrectionMode, string> = {
  minimal: 'Nur Fehler',
  natural: 'Natürlicher formuliert',
  'level-adjusted': 'An Niveau angepasst'
}

onMounted(() => {
  loadEntry()
})

async function loadEntry() {
  loading.value = true
  errorMessage.value = ''

  const routeId = route.params.id
  const entryId = Array.isArray(routeId) ? routeId[0] : routeId

  if (!entryId) {
    errorMessage.value = 'Der Eintrag wurde nicht gefunden.'
    loading.value = false
    return
  }

  try {
    const { data, error } = await $supabase
      .from('diary_entries')
      .select(`
        id,
        entry_date,
        original_text,
        corrected_text,
        feedback_russian,
        corrections,
        vocabulary,
        language_level,
        correction_mode,
        analysis_status,
        created_at
      `)
      .eq('id', entryId)
      .maybeSingle()

    if (error) {
      throw error
    }

    if (!data) {
      errorMessage.value = 'Der Eintrag wurde nicht gefunden.'
      return
    }

    entry.value = data as DiaryEntry
  } catch {
    errorMessage.value = 'Der Eintrag konnte nicht geladen werden.'
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

function vocabularyLabel(word: VocabularyItem) {
  const lemma = word.lemma
    .trim()
    .replace(/^(der|die|das)\s+/i, '')

  return word.article ? `${word.article} ${lemma}` : lemma
}
</script>

<template>
  <div class="detail-shell">
    <header class="detail-topbar">
      <NuxtLink class="detail-brand" to="/">
        <span>D</span>

        <span>
          <strong>Deutsch Diary</strong>
          <small>Deine persönliche Auswertung</small>
        </span>
      </NuxtLink>

      <NuxtLink class="back-link" to="/entries">
        ← Meine Einträge
      </NuxtLink>
    </header>

    <main class="detail-content">
      <div v-if="loading" class="detail-state">
        Eintrag wird geladen …
      </div>

      <div v-else-if="errorMessage" class="detail-state error">
        <p>{{ errorMessage }}</p>
        <NuxtLink to="/entries">Zurück zur Übersicht</NuxtLink>
      </div>

      <template v-else-if="entry">
        <section class="detail-intro">
          <div>
            <p class="eyebrow">Dein Tagebucheintrag</p>
            <h1>{{ formatDate(entry.entry_date) }}</h1>

            <p class="detail-meta">
              {{ countWords(entry.original_text) }} Wörter
            </p>
          </div>

          <div class="detail-badges">
            <span class="level-badge">
              {{ entry.language_level }}
            </span>

            <span class="mode-badge">
              {{ correctionLabels[entry.correction_mode] }}
            </span>
          </div>
        </section>

        <section class="original-card">
          <p class="eyebrow">Originaltext</p>
          <p>{{ entry.original_text }}</p>
        </section>

        <section
          v-if="entry.analysis_status === 'completed' && entry.corrected_text"
          class="analysis-card"
        >
          <div class="analysis-heading">
            <p class="eyebrow">Deine Auswertung</p>
            <h2>Korrigierter Text</h2>
          </div>

          <p class="corrected-text">
            {{ entry.corrected_text }}
          </p>

          <div
            v-if="entry.feedback_russian"
            class="feedback-box"
          >
            <h3>Краткий комментарий</h3>
            <p>{{ entry.feedback_russian }}</p>
          </div>

          <div class="analysis-section">
            <h3>Исправления</h3>

            <p
              v-if="!entry.corrections.length"
              class="empty-analysis"
            >
              Ошибок не найдено.
            </p>

            <ul v-else class="correction-list">
              <li
                v-for="(correction, index) in entry.corrections"
                :key="`${correction.original}-${index}`"
              >
                <p>
                  <del>{{ correction.original }}</del>
                  <span aria-hidden="true">→</span>
                  <strong>{{ correction.corrected }}</strong>
                </p>

                <small>
                  {{ correction.explanationRussian }}
                </small>
              </li>
            </ul>
          </div>

          <div class="analysis-section">
            <h3>Новые слова</h3>

            <p
              v-if="!entry.vocabulary.length"
              class="empty-analysis"
            >
              Для этой записи новые слова не выбраны.
            </p>

            <div v-else class="vocabulary-grid">
              <article
                v-for="(word, index) in entry.vocabulary"
                :key="`${word.lemma}-${index}`"
                class="vocabulary-card"
              >
                <p class="vocabulary-word">
                  {{ vocabularyLabel(word) }}
                </p>

                <p class="vocabulary-type">
                  {{ word.partOfSpeech }}
                </p>

                <p class="vocabulary-translation">
                  {{ word.translationRussian }}
                </p>

                <small>{{ word.exampleGerman }}</small>
              </article>
            </div>
          </div>
        </section>

        <section v-else class="analysis-pending">
          <h2>
            {{
              entry.analysis_status === 'failed'
                ? 'Analyse fehlgeschlagen'
                : 'Noch nicht analysiert'
            }}
          </h2>

          <p>
            {{
              entry.analysis_status === 'failed'
                ? 'Der Originaltext wurde gespeichert, aber die Analyse konnte nicht abgeschlossen werden.'
                : 'Für diesen Eintrag ist noch keine vollständige Auswertung vorhanden.'
            }}
          </p>
        </section>
      </template>
    </main>
  </div>
</template>

<style scoped>
.detail-shell {
  min-height: 100vh;
}

.detail-topbar {
  display: flex;
  align-items: center;
  justify-content: space-between;
  width: min(980px, calc(100% - 40px));
  margin: 0 auto;
  padding: 28px 0;
}

.detail-brand {
  display: inline-flex;
  align-items: center;
  gap: 12px;
}

.detail-brand > span:first-child {
  display: grid;
  place-items: center;
  width: 42px;
  height: 42px;
  border-radius: 50%;
  color: white;
  background: var(--forest);
  font-family: Georgia, serif;
  font-size: 24px;
}

.detail-brand strong,
.detail-brand small {
  display: block;
}

.detail-brand strong {
  font-family: Georgia, serif;
  font-size: 18px;
}

.detail-brand small {
  margin-top: 2px;
  color: var(--muted);
  font-size: 11px;
}

.back-link {
  padding: 11px 15px;
  border: 1px solid var(--line);
  border-radius: 11px;
  color: var(--forest-dark);
  background: var(--surface);
  font-size: 13px;
  font-weight: 800;
}

.back-link:hover {
  border-color: var(--forest);
  background: var(--sage);
}

.detail-content {
  width: min(980px, calc(100% - 40px));
  margin: 42px auto 80px;
}

.detail-state {
  padding: 48px;
  border: 1px solid var(--line);
  border-radius: 20px;
  background: var(--surface);
  color: var(--muted);
  text-align: center;
}

.detail-state.error {
  color: #8a2e2e;
}

.detail-state a {
  display: inline-block;
  margin-top: 12px;
  color: var(--forest);
  font-weight: 800;
}

.detail-intro {
  display: flex;
  align-items: flex-end;
  justify-content: space-between;
  gap: 24px;
  margin-bottom: 28px;
}

.detail-intro h1 {
  margin-bottom: 8px;
  font-size: clamp(38px, 6vw, 62px);
  text-transform: capitalize;
}

.detail-meta {
  margin: 0;
  color: var(--muted);
}

.detail-badges {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
}

.level-badge,
.mode-badge {
  padding: 7px 11px;
  border-radius: 999px;
  font-size: 12px;
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

.original-card,
.analysis-card,
.analysis-pending {
  border: 1px solid var(--line);
  border-radius: 22px;
  background: var(--surface);
  box-shadow: 0 20px 60px rgba(32, 45, 39, 0.07);
}

.original-card {
  margin-bottom: 24px;
  padding: 26px 30px;
}

.original-card > p:last-child {
  margin: 0;
  font-family: Georgia, serif;
  font-size: 20px;
  line-height: 1.7;
  white-space: pre-wrap;
}

.analysis-card {
  padding: 30px;
}

.analysis-heading h2 {
  margin-bottom: 22px;
  font-size: clamp(34px, 5vw, 48px);
}

.corrected-text {
  margin-bottom: 24px;
  padding: 22px;
  border-radius: 14px;
  background: rgba(219, 232, 223, 0.35);
  font-family: Georgia, serif;
  font-size: 20px;
  line-height: 1.7;
  white-space: pre-wrap;
}

.feedback-box {
  margin-bottom: 28px;
  padding: 18px 20px;
  border-left: 4px solid var(--gold);
  background: #fffaf0;
}

.feedback-box h3,
.analysis-section h3 {
  margin-bottom: 10px;
}

.feedback-box p {
  margin: 0;
  color: var(--muted);
  line-height: 1.6;
}

.analysis-section + .analysis-section {
  margin-top: 28px;
}

.empty-analysis {
  margin: 0;
  color: var(--muted);
}

.correction-list {
  display: grid;
  gap: 12px;
  margin: 0;
  padding: 0;
  list-style: none;
}

.correction-list li {
  padding: 15px;
  border: 1px solid var(--line);
  border-radius: 12px;
}

.correction-list p {
  display: flex;
  flex-wrap: wrap;
  gap: 9px;
  margin-bottom: 7px;
}

.correction-list del {
  color: #9b4a45;
}

.correction-list strong {
  color: var(--forest);
}

.correction-list small,
.vocabulary-card small {
  color: var(--muted);
  line-height: 1.5;
}

.vocabulary-grid {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 12px;
}

.vocabulary-card {
  padding: 16px;
  border: 1px solid var(--line);
  border-radius: 12px;
}

.vocabulary-word {
  margin-bottom: 4px;
  color: var(--forest-dark);
  font-weight: 800;
}

.vocabulary-type {
  margin-bottom: 6px;
  color: var(--muted);
  font-size: 11px;
  font-weight: 700;
  text-transform: uppercase;
}

.vocabulary-translation {
  margin-bottom: 9px;
  color: var(--muted);
}

.analysis-pending {
  padding: 30px;
}

.analysis-pending h2 {
  margin-bottom: 10px;
}

.analysis-pending p {
  margin: 0;
  color: var(--muted);
  line-height: 1.6;
}

@media (max-width: 640px) {
  .detail-brand small {
    display: none;
  }

  .detail-intro {
    align-items: flex-start;
    flex-direction: column;
  }

  .analysis-card,
  .original-card {
    padding: 22px;
  }

  .vocabulary-grid {
    grid-template-columns: 1fr;
  }
}
</style>