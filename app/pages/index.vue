<script setup lang="ts">
type LanguageLevel = 'B1' | 'B2' | 'C1'
type CorrectionMode = 'minimal' | 'natural' | 'level-adjusted'

const levels: LanguageLevel[] = ['B1', 'B2', 'C1']
const selectedLevel = ref<LanguageLevel>('B1')
const correctionMode = ref<CorrectionMode>('minimal')
const diaryText = ref('')

const formattedDate = new Intl.DateTimeFormat('de-DE', {
  weekday: 'long',
  day: '2-digit',
  month: 'long',
  year: 'numeric'
}).format(new Date())

const wordCount = computed(() => {
  const text = diaryText.value.trim()
  return text ? text.split(/\s+/).length : 0
})
</script>

<template>
  <div class="app-shell">
    <header class="topbar">
      <NuxtLink class="brand" to="/" aria-label="Deutsch Diary Startseite">
        <span class="brand-mark">D</span>
        <span>
          <strong>Deutsch Diary</strong>
          <small>Schreiben. Verstehen. Wachsen.</small>
        </span>
      </NuxtLink>

      <button class="profile-button" type="button" aria-label="Profil öffnen">
        <span>AR</span>
      </button>
    </header>

    <main class="page-content">
      <section class="intro">
        <p class="eyebrow">Dein persönlicher Lernmoment</p>
        <h1>Was ist heute passiert?</h1>
        <p>
          Schreibe frei auf Deutsch. Wir verbessern nur so viel, wie du möchtest,
          und verwandeln deinen Alltag in persönlichen Wortschatz.
        </p>
      </section>

      <section class="editor-card">
        <div class="editor-heading">
          <div>
            <span class="status-dot" aria-hidden="true" />
            <span class="date-label">{{ formattedDate }}</span>
          </div>
          <span class="draft-label">Entwurf wird lokal gespeichert</span>
        </div>

        <div class="settings-grid">
          <fieldset class="setting-group">
            <legend>Zielniveau</legend>
            <div class="level-switch" role="group" aria-label="Zielniveau wählen">
              <button
                v-for="level in levels"
                :key="level"
                type="button"
                :class="{ active: selectedLevel === level }"
                :aria-pressed="selectedLevel === level"
                @click="selectedLevel = level"
              >
                {{ level }}
              </button>
            </div>
          </fieldset>

          <label class="setting-group">
            <span>Korrektur</span>
            <select v-model="correctionMode">
              <option value="minimal">Nur Fehler korrigieren</option>
              <option value="natural">Natürlicher formulieren</option>
              <option value="level-adjusted">An Niveau anpassen</option>
            </select>
          </label>
        </div>

        <label class="writing-area">
          <span class="sr-only">Tagebucheintrag</span>
          <textarea
            v-model="diaryText"
            rows="12"
            maxlength="6000"
            placeholder="Heute habe ich ..."
          />
        </label>

        <div class="editor-footer">
          <div class="writing-meta">
            <span>{{ wordCount }} Wörter</span>
            <span>Ziel: 50–150 Wörter</span>
          </div>

          <div class="actions">
            <button class="secondary-button" type="button" disabled>
              Mikrofon
              <span class="soon-badge">bald</span>
            </button>
            <button class="primary-button" type="button" :disabled="!diaryText.trim()">
              Speichern & analysieren
            </button>
          </div>
        </div>
      </section>

      <section class="learning-preview" aria-labelledby="learning-title">
        <div>
          <p class="eyebrow">So lernst du</p>
          <h2 id="learning-title">Aus deinem Tag wird dein Deutsch</h2>
        </div>
        <div class="steps">
          <article>
            <span>01</span>
            <h3>Original behalten</h3>
            <p>Dein eigener Text bleibt immer unverändert gespeichert.</p>
          </article>
          <article>
            <span>02</span>
            <h3>Fehler verstehen</h3>
            <p>Kurze Erklärungen zeigen dir genau, was sich geändert hat.</p>
          </article>
          <article>
            <span>03</span>
            <h3>Wörter wiederholen</h3>
            <p>Wichtige Begriffe landen mit deinem Beispiel im Wörterbuch.</p>
          </article>
        </div>
      </section>
    </main>
  </div>
</template>
