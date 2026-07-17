<script setup lang="ts">
definePageMeta({
  middleware: 'auth'
})

type LanguageLevel = 'B1' | 'B2' | 'C1'

type CorrectionMode =
  | 'minimal'
  | 'natural'
  | 'level-adjusted'

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

interface AnalysisResult {
  correctedText: string
  feedbackRussian: string
  corrections: Correction[]
  vocabulary: VocabularyItem[]
}

interface AnalyzeResponse {
  analysis: AnalysisResult
}

interface TranscriptionResponse {
  text: string
}

const { $supabase } = useNuxtApp()

const profileLabel = ref('DU')
const currentUserId = ref<string | null>(null)

const levels: LanguageLevel[] = [
  'B1',
  'B2',
  'C1'
]

const selectedLevel =
  ref<LanguageLevel>('B1')

const correctionMode =
  ref<CorrectionMode>('minimal')

const diaryText = ref('')

const saving = ref(false)
const saveMessage = ref('')
const saveError = ref('')

const analysisResult =
  ref<AnalysisResult | null>(null)

const draftReady = ref(false)

const recording = ref(false)
const transcribing = ref(false)
const microphoneError = ref('')

let mediaRecorder: MediaRecorder | null = null
let mediaStream: MediaStream | null = null
let audioChunks: Blob[] = []
let discardRecording = false

let recordingTimer:
  | ReturnType<typeof setTimeout>
  | undefined

let draftSaveTimer:
  | ReturnType<typeof setTimeout>
  | undefined

const formattedDate =
  new Intl.DateTimeFormat('de-DE', {
    weekday: 'long',
    day: '2-digit',
    month: 'long',
    year: 'numeric'
  }).format(new Date())

const wordCount = computed(() => {
  const text = diaryText.value.trim()

  return text
    ? text.split(/\s+/).length
    : 0
})

const draftStatusLabel = computed(() => {
  if (!draftReady.value) {
    return 'Lokaler Entwurf wird geladen …'
  }

  if (diaryText.value.trim()) {
    return 'Entwurf wird lokal gespeichert'
  }

  return 'Privat und nur für dich sichtbar'
})

watch(
  [
    diaryText,
    selectedLevel,
    correctionMode
  ],
  () => {
    if (
      !import.meta.client ||
      !draftReady.value ||
      !currentUserId.value
    ) {
      return
    }

    if (draftSaveTimer) {
      clearTimeout(draftSaveTimer)
    }

    draftSaveTimer = setTimeout(async () => {
      if (!currentUserId.value) {
        return
      }

      try {
        await saveOfflineDraft({
          userId: currentUserId.value,
          text: diaryText.value,
          languageLevel: selectedLevel.value,
          correctionMode: correctionMode.value
        })
      } catch (error) {
        console.error(
          'Der lokale Entwurf konnte nicht gespeichert werden:',
          error
        )
      }
    }, 500)
  }
)

onMounted(async () => {
  const { data } =
    await $supabase.auth.getSession()

  const session = data.session
  const email = session?.user.email

  if (email) {
    profileLabel.value =
      email.slice(0, 2).toUpperCase()
  }

  if (!session) {
    draftReady.value = true
    return
  }

  currentUserId.value = session.user.id

  try {
    const draft = await loadOfflineDraft(
      session.user.id
    )

    if (draft) {
      diaryText.value = draft.text

      selectedLevel.value =
        draft.languageLevel

      correctionMode.value =
        draft.correctionMode
    }
  } catch (error) {
    console.error(
      'Der lokale Entwurf konnte nicht geladen werden:',
      error
    )
  } finally {
    draftReady.value = true
  }
})

onBeforeUnmount(() => {
  if (draftSaveTimer) {
    clearTimeout(draftSaveTimer)
  }

  if (recordingTimer) {
    clearTimeout(recordingTimer)
  }

  discardRecording = true

  if (
    mediaRecorder &&
    mediaRecorder.state !== 'inactive'
  ) {
    mediaRecorder.stop()
  }

  releaseMicrophone()
})

function releaseMicrophone() {
  mediaStream?.getTracks().forEach(
    (track) => track.stop()
  )

  mediaStream = null
}

function getSupportedAudioType() {
  const types = [
    'audio/webm;codecs=opus',
    'audio/webm',
    'audio/mp4'
  ]

  return types.find((type) =>
    MediaRecorder.isTypeSupported(type)
  )
}

async function transcribeAudio(audio: Blob) {
  if (!navigator.onLine) {
    microphoneError.value =
      'Die Spracherkennung benötigt eine Internetverbindung.'
    return
  }

  if (!audio.size) {
    microphoneError.value =
      'Die Aufnahme ist leer. Bitte versuche es erneut.'
    return
  }

  transcribing.value = true
  microphoneError.value = ''
  saveMessage.value = ''
  saveError.value = ''

  try {
    const {
      data: { session }
    } = await $supabase.auth.getSession()

    if (!session) {
      await navigateTo('/login')
      return
    }

    const extension =
      audio.type.includes('mp4')
        ? 'm4a'
        : audio.type.includes('wav')
          ? 'wav'
          : 'webm'

    const formData = new FormData()

    formData.append(
      'audio',
      audio,
      `diary-recording.${extension}`
    )

    const response =
      await $fetch<TranscriptionResponse>(
        '/api/transcribe',
        {
          method: 'POST',

          headers: {
            Authorization:
              `Bearer ${session.access_token}`
          },

          body: formData
        }
      )

    const transcription =
      response.text.trim()

    if (!transcription) {
      throw new Error(
        'The transcription is empty'
      )
    }

    diaryText.value = [
      diaryText.value.trim(),
      transcription
    ]
      .filter(Boolean)
      .join(' ')
  } catch (error) {
    console.error(
      'Audio transcription failed:',
      error
    )

    microphoneError.value =
      'Die Aufnahme konnte nicht erkannt werden. Bitte versuche es erneut.'
  } finally {
    transcribing.value = false
  }
}

async function startRecording() {
  microphoneError.value = ''
  saveMessage.value = ''
  saveError.value = ''

  if (!navigator.onLine) {
    microphoneError.value =
      'Die Spracherkennung benötigt eine Internetverbindung.'
    return
  }

  if (
    !navigator.mediaDevices ||
    !navigator.mediaDevices.getUserMedia ||
    typeof MediaRecorder === 'undefined'
  ) {
    microphoneError.value =
      'Dein Browser unterstützt keine Sprachaufnahme.'
    return
  }

  try {
    mediaStream =
      await navigator.mediaDevices.getUserMedia({
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true
        }
      })

    const supportedType =
      getSupportedAudioType()

    mediaRecorder = supportedType
      ? new MediaRecorder(mediaStream, {
          mimeType: supportedType
        })
      : new MediaRecorder(mediaStream)

    audioChunks = []
    discardRecording = false

    mediaRecorder.addEventListener(
      'dataavailable',
      (event) => {
        if (event.data.size > 0) {
          audioChunks.push(event.data)
        }
      }
    )

    mediaRecorder.addEventListener(
      'stop',
      () => {
        const audioType =
          mediaRecorder?.mimeType ||
          supportedType ||
          'audio/webm'

        const audio = new Blob(
          audioChunks,
          {
            type: audioType
          }
        )

        audioChunks = []
        mediaRecorder = null
        releaseMicrophone()

        if (!discardRecording) {
          void transcribeAudio(audio)
        }

        discardRecording = false
      },
      {
        once: true
      }
    )

    mediaRecorder.addEventListener(
      'error',
      () => {
        microphoneError.value =
          'Bei der Aufnahme ist ein Fehler aufgetreten.'

        recording.value = false
        mediaRecorder = null
        releaseMicrophone()
      },
      {
        once: true
      }
    )

    mediaRecorder.start(1000)
    recording.value = true

    recordingTimer = setTimeout(
      stopRecording,
      5 * 60 * 1000
    )
  } catch (error) {
    console.error(
      'Microphone access failed:',
      error
    )

    microphoneError.value =
      'Der Zugriff auf das Mikrofon wurde nicht erlaubt.'

    mediaRecorder = null
    releaseMicrophone()
  }
}

function stopRecording() {
  if (recordingTimer) {
    clearTimeout(recordingTimer)
    recordingTimer = undefined
  }

  if (
    mediaRecorder &&
    mediaRecorder.state !== 'inactive'
  ) {
    mediaRecorder.stop()
  }

  recording.value = false
}

async function toggleRecording() {
  if (recording.value) {
    stopRecording()
    return
  }

  await startRecording()
}

async function signOut() {
  if (recording.value) {
    discardRecording = true
    stopRecording()
  }

  await $supabase.auth.signOut()
  await navigateTo('/login')
}

async function saveVocabularyItems(
  entryId: string,
  vocabulary: VocabularyItem[]
) {
  const results = await Promise.all(
    vocabulary.map((item) =>
      $supabase.rpc(
        'save_vocabulary_item',
        {
          p_source_entry_id: entryId,
          p_word: item.lemma,
          p_article: item.article,
          p_part_of_speech:
            item.partOfSpeech,
          p_translation_russian:
            item.translationRussian,
          p_example_german:
            item.exampleGerman
        }
      )
    )
  )

  const failedResult = results.find(
    (result) => result.error
  )

  if (failedResult?.error) {
    throw failedResult.error
  }
}

async function saveEntry() {
  const originalText =
    diaryText.value.trim()

  if (
    !originalText ||
    saving.value ||
    recording.value ||
    transcribing.value
  ) {
    return
  }

  saving.value = true
  saveMessage.value = ''
  saveError.value = ''
  microphoneError.value = ''
  analysisResult.value = null

  let entryId: string | null = null

  const now = new Date()

  const localDate = new Date(
    now.getTime() -
      now.getTimezoneOffset() * 60_000
  )
    .toISOString()
    .slice(0, 10)

  try {
    const {
      data: { session }
    } = await $supabase.auth.getSession()

    if (!session) {
      await navigateTo('/login')
      return
    }

    const {
      data: entry,
      error: insertError
    } = await $supabase
      .from('diary_entries')
      .insert({
        entry_date: localDate,
        original_text: originalText,
        language_level:
          selectedLevel.value,
        correction_mode:
          correctionMode.value,
        analysis_status: 'processing'
      })
      .select('id')
      .single()

    if (insertError) {
      throw insertError
    }

    entryId = entry.id

    const response =
      await $fetch<AnalyzeResponse>(
        '/api/analyze',
        {
          method: 'POST',

          headers: {
            Authorization:
              `Bearer ${session.access_token}`
          },

          body: {
            text: originalText,
            level: selectedLevel.value,
            correctionMode:
              correctionMode.value
          }
        }
      )

    const analysis = response.analysis

    const { error: updateError } =
      await $supabase
        .from('diary_entries')
        .update({
          corrected_text:
            analysis.correctedText,
          feedback_russian:
            analysis.feedbackRussian,
          corrections:
            analysis.corrections,
          vocabulary:
            analysis.vocabulary,
          analysis_status: 'completed'
        })
        .eq('id', entryId)

    if (updateError) {
      throw updateError
    }

    let vocabularySaved = true

    if (analysis.vocabulary.length > 0) {
      try {
        await saveVocabularyItems(
          entryId,
          analysis.vocabulary
        )
      } catch (error) {
        vocabularySaved = false

        console.error(
          'Vocabulary could not be saved:',
          error
        )
      }
    }

    analysisResult.value = analysis
    diaryText.value = ''

    if (currentUserId.value) {
      await deleteOfflineDraft(
        currentUserId.value
      )
    }

    saveMessage.value =
      vocabularySaved
        ? 'Dein Eintrag wurde gespeichert, analysiert und zum Wortschatz hinzugefügt.'
        : 'Dein Eintrag wurde analysiert, aber der Wortschatz konnte nicht aktualisiert werden.'
  } catch {
    if (entryId) {
      await $supabase
        .from('diary_entries')
        .update({
          analysis_status: 'failed'
        })
        .eq('id', entryId)

      saveError.value =
        'Dein Originaltext wurde gespeichert, aber die Analyse ist fehlgeschlagen.'
    } else {
      saveError.value =
        'Der Eintrag konnte nicht gespeichert werden. Dein Entwurf bleibt lokal erhalten.'
    }
  } finally {
    saving.value = false
  }
}
</script>

<template>
  <div class="app-shell">
    <header class="topbar">
      <NuxtLink
        class="brand"
        to="/"
        aria-label="Deutsch Diary Startseite"
      >
        <span class="brand-mark">D</span>

        <span>
          <strong>Deutsch Diary</strong>
          <small>
            Schreiben. Verstehen. Wachsen.
          </small>
        </span>
      </NuxtLink>

      <div class="topbar-actions">
        <NuxtLink
          class="history-link"
          to="/vocabulary"
        >
          Mein Wortschatz
        </NuxtLink>

        <NuxtLink
          class="history-link"
          to="/entries"
        >
          Meine Einträge
        </NuxtLink>

        <button
          class="profile-button"
          type="button"
          aria-label="Abmelden"
          title="Abmelden"
          @click="signOut"
        >
          <span>{{ profileLabel }}</span>
        </button>
      </div>
    </header>

    <main class="page-content">
      <section class="intro">
        <p class="eyebrow">
          Dein persönlicher Lernmoment
        </p>

        <h1>Was ist heute passiert?</h1>

        <p>
          Schreibe frei auf Deutsch. Wir verbessern nur so viel,
          wie du möchtest, und verwandeln deinen Alltag in
          persönlichen Wortschatz.
        </p>
      </section>

      <section class="editor-card">
        <div class="editor-heading">
          <div>
            <span
              class="status-dot"
              aria-hidden="true"
            />

            <span class="date-label">
              {{ formattedDate }}
            </span>
          </div>

          <span class="draft-label">
            {{ draftStatusLabel }}
          </span>
        </div>

        <div class="settings-grid">
          <fieldset class="setting-group">
            <legend>Zielniveau</legend>

            <div
              class="level-switch"
              role="group"
              aria-label="Zielniveau wählen"
            >
              <button
                v-for="level in levels"
                :key="level"
                type="button"
                :class="{
                  active: selectedLevel === level
                }"
                :aria-pressed="
                  selectedLevel === level
                "
                @click="selectedLevel = level"
              >
                {{ level }}
              </button>
            </div>
          </fieldset>

          <label class="setting-group">
            <span>Korrektur</span>

            <select v-model="correctionMode">
              <option value="minimal">
                Nur Fehler korrigieren
              </option>

              <option value="natural">
                Natürlicher formulieren
              </option>

              <option value="level-adjusted">
                An Niveau anpassen
              </option>
            </select>
          </label>
        </div>

        <label class="writing-area">
          <span class="sr-only">
            Tagebucheintrag
          </span>

          <textarea
            v-model="diaryText"
            rows="12"
            maxlength="6000"
            placeholder="Heute habe ich ..."
            @input="
              saveMessage = '';
              saveError = '';
              microphoneError = ''
            "
          />
        </label>

        <p
          v-if="
            recording ||
            transcribing ||
            microphoneError
          "
          class="microphone-status"
          :class="{
            error: microphoneError,
            active: recording
          }"
          role="status"
          aria-live="polite"
        >
          {{
            microphoneError ||
            (
              recording
                ? 'Aufnahme läuft … Sprich auf Deutsch und klicke danach auf „Aufnahme stoppen“.'
                : 'Deine Aufnahme wird in Text umgewandelt …'
            )
          }}
        </p>

        <p
          v-if="saveMessage || saveError"
          class="save-feedback"
          :class="{ error: saveError }"
          role="status"
          aria-live="polite"
        >
          {{ saveError || saveMessage }}
        </p>

        <div class="editor-footer">
          <div class="writing-meta">
            <span>{{ wordCount }} Wörter</span>
            <span>Ziel: 50–150 Wörter</span>
          </div>

          <div class="actions">
            <button
              class="secondary-button microphone-button"
              :class="{ recording }"
              type="button"
              :disabled="transcribing || saving"
              :aria-pressed="recording"
              @click="toggleRecording"
            >
              <span
                class="microphone-dot"
                aria-hidden="true"
              />

              {{
                recording
                  ? 'Aufnahme stoppen'
                  : transcribing
                    ? 'Wird erkannt …'
                    : 'Mikrofon'
              }}
            </button>

            <button
              class="primary-button"
              type="button"
              :disabled="
                !diaryText.trim() ||
                saving ||
                recording ||
                transcribing
              "
              @click="saveEntry"
            >
              {{
                saving
                  ? 'Wird analysiert …'
                  : 'Speichern & analysieren'
              }}
            </button>
          </div>
        </div>
      </section>

      <section
        v-if="analysisResult"
        class="analysis-result"
        aria-labelledby="analysis-title"
      >
        <div class="analysis-heading">
          <p class="eyebrow">
            Deine Auswertung
          </p>

          <h2 id="analysis-title">
            Korrigierter Text
          </h2>
        </div>

        <p class="corrected-text">
          {{ analysisResult.correctedText }}
        </p>

        <div class="feedback-box">
          <h3>Краткий комментарий</h3>
          <p>
            {{ analysisResult.feedbackRussian }}
          </p>
        </div>

        <div class="analysis-section">
          <h3>Исправления</h3>

          <p
            v-if="
              !analysisResult.corrections.length
            "
            class="empty-analysis"
          >
            Ошибок не найдено.
          </p>

          <ul
            v-else
            class="correction-list"
          >
            <li
              v-for="(
                correction,
                index
              ) in analysisResult.corrections"
              :key="
                `${correction.original}-${index}`
              "
            >
              <p>
                <del>
                  {{ correction.original }}
                </del>

                <span aria-hidden="true">
                  →
                </span>

                <strong>
                  {{ correction.corrected }}
                </strong>
              </p>

              <small>
                {{
                  correction.explanationRussian
                }}
              </small>
            </li>
          </ul>
        </div>

        <div class="analysis-section">
          <h3>Новые слова</h3>

          <p
            v-if="
              !analysisResult.vocabulary.length
            "
            class="empty-analysis"
          >
            Для этой записи новые слова не выбраны.
          </p>

          <div
            v-else
            class="vocabulary-grid"
          >
            <article
              v-for="(
                word,
                index
              ) in analysisResult.vocabulary"
              :key="`${word.lemma}-${index}`"
              class="vocabulary-card"
            >
              <p class="vocabulary-word">
                <span v-if="word.article">
                  {{ word.article }}
                </span>

                {{
                  word.lemma.replace(
                    /^(der|die|das)\s+/i,
                    ''
                  )
                }}
              </p>

              <p class="vocabulary-type">
                {{ word.partOfSpeech }}
              </p>

              <p class="vocabulary-translation">
                {{ word.translationRussian }}
              </p>

              <small>
                {{ word.exampleGerman }}
              </small>
            </article>
          </div>
        </div>

        <div class="analysis-navigation">
          <NuxtLink to="/vocabulary">
            Zum Wortschatz →
          </NuxtLink>
        </div>
      </section>

      <section
        class="learning-preview"
        aria-labelledby="learning-title"
      >
        <div>
          <p class="eyebrow">
            So lernst du
          </p>

          <h2 id="learning-title">
            Aus deinem Tag wird dein Deutsch
          </h2>
        </div>

        <div class="steps">
          <article>
            <span>01</span>

            <h3>Original behalten</h3>

            <p>
              Dein eigener Text bleibt immer
              unverändert gespeichert.
            </p>
          </article>

          <article>
            <span>02</span>

            <h3>Fehler verstehen</h3>

            <p>
              Kurze Erklärungen zeigen dir genau,
              was sich geändert hat.
            </p>
          </article>

          <article>
            <span>03</span>

            <h3>Wörter wiederholen</h3>

            <p>
              Wichtige Begriffe landen mit deinem
              Beispiel im Wörterbuch.
            </p>
          </article>
        </div>
      </section>
    </main>
  </div>
</template>

<style scoped>
.topbar-actions {
  display: flex;
  align-items: center;
  justify-content: flex-end;
  gap: 10px;
}

.history-link {
  display: inline-flex;
  min-height: 42px;
  align-items: center;
  justify-content: center;
  padding: 0 15px;
  border: 1px solid var(--line);
  border-radius: 11px;
  color: var(--forest-dark);
  background: var(--surface);
  font-size: 13px;
  font-weight: 800;
}

.history-link:hover {
  border-color: var(--forest);
  background: var(--sage);
}

.microphone-button {
  gap: 8px;
}

.microphone-button.recording {
  border-color: #a33b35;
  color: #8a2e2e;
  background: #f8e1df;
}

.microphone-dot {
  width: 9px;
  height: 9px;
  flex: 0 0 9px;
  border-radius: 50%;
  background: currentColor;
}

.microphone-button.recording .microphone-dot {
  background: #c8463e;
  box-shadow:
    0 0 0 5px
    rgba(200, 70, 62, 0.14);
  animation:
    microphone-pulse 1.2s infinite;
}

.microphone-status {
  margin: 0;
  padding: 13px 24px;
  border-top: 1px solid var(--line);
  color: var(--muted);
  background: #fffaf0;
  font-size: 14px;
  line-height: 1.5;
}

.microphone-status.active {
  color: #8a2e2e;
  background: #f8e1df;
}

.microphone-status.error {
  color: #8a2e2e;
  background: #f8e1df;
  font-weight: 700;
}

.save-feedback {
  margin: 0;
  padding: 14px 24px;
  border-top: 1px solid var(--line);
  color: var(--forest-dark);
  background: var(--sage);
  font-size: 14px;
  font-weight: 700;
}

.save-feedback.error {
  color: #8a2e2e;
  background: #f8e1df;
}

.analysis-result {
  margin-top: 26px;
  padding: 30px;
  border: 1px solid var(--line);
  border-radius: 22px;
  background: var(--surface);
  box-shadow:
    0 20px 60px
    rgba(32, 45, 39, 0.08);
}

.analysis-heading h2 {
  margin-bottom: 22px;
  font-size: clamp(34px, 5vw, 48px);
}

.corrected-text {
  margin-bottom: 24px;
  padding: 22px;
  border-radius: 14px;
  background:
    rgba(219, 232, 223, 0.35);
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
  line-height: 1.5;
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
  grid-template-columns:
    repeat(2, minmax(0, 1fr));
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

.analysis-navigation {
  display: flex;
  justify-content: flex-end;
  margin-top: 28px;
  padding-top: 20px;
  border-top: 1px solid var(--line);
}

.analysis-navigation a {
  display: inline-flex;
  min-height: 42px;
  align-items: center;
  justify-content: center;
  padding: 0 16px;
  border-radius: 11px;
  color: white;
  background: var(--forest);
  font-size: 13px;
  font-weight: 800;
}

.analysis-navigation a:hover {
  background: var(--forest-dark);
}

@keyframes microphone-pulse {
  50% {
    opacity: 0.45;
    transform: scale(0.85);
  }
}

@media (max-width: 760px) {
  .topbar-actions {
    flex-wrap: wrap;
  }
}

@media (max-width: 640px) {
  .analysis-result {
    padding: 22px;
  }

  .vocabulary-grid {
    grid-template-columns: 1fr;
  }
}

@media (max-width: 540px) {
  .topbar-actions {
    gap: 6px;
  }

  .history-link {
    min-height: 38px;
    padding: 0 9px;
    font-size: 11px;
  }

  .microphone-status {
    padding: 12px 16px;
  }
}
</style>