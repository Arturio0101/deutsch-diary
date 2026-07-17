<script setup lang="ts">
type AuthMode = 'login' | 'register'

const { $supabase } = useNuxtApp()

const mode = ref<AuthMode>('login')
const email = ref('')
const password = ref('')
const loading = ref(false)
const errorMessage = ref('')
const successMessage = ref('')

const submitLabel = computed(() =>
  mode.value === 'login' ? 'Anmelden' : 'Konto erstellen'
)

function changeMode(nextMode: AuthMode) {
  mode.value = nextMode
  errorMessage.value = ''
  successMessage.value = ''
}

async function submit() {
  errorMessage.value = ''
  successMessage.value = ''

  if (!email.value || password.value.length < 8) {
    errorMessage.value =
      'Bitte gib eine gültige E-Mail-Adresse und mindestens 8 Zeichen ein.'
    return
  }

  loading.value = true

  try {
    if (mode.value === 'register') {
      const { data, error } = await $supabase.auth.signUp({
        email: email.value,
        password: password.value,
        options: {
          emailRedirectTo: `${window.location.origin}/`
        }
      })

      if (error) {
        throw error
      }

      if (data.session) {
        await navigateTo('/')
      } else {
        successMessage.value =
          'Fast geschafft! Bitte bestätige deine E-Mail-Adresse.'
      }
    } else {
      const { error } = await $supabase.auth.signInWithPassword({
        email: email.value,
        password: password.value
      })

      if (error) {
        throw error
      }

      await navigateTo('/')
    }
  } catch (error) {
    errorMessage.value =
      error instanceof Error
        ? error.message
        : 'Es ist ein unerwarteter Fehler aufgetreten.'
  } finally {
    loading.value = false
  }
}

onMounted(async () => {
  const { data } = await $supabase.auth.getSession()

  if (data.session) {
    await navigateTo('/')
  }
})
</script>

<template>
  <main class="auth-page">
    <section class="auth-card">
      <NuxtLink class="auth-brand" to="/">
        <span>D</span>
        <strong>Deutsch Diary</strong>
      </NuxtLink>

      <p class="auth-eyebrow">Dein persönliches Sprachtagebuch</p>
      <h1>
        {{ mode === 'login' ? 'Willkommen zurück' : 'Beginne deine Reise' }}
      </h1>
      <p class="auth-description">
        Schreibe über deinen Tag und verbessere dabei Schritt für Schritt
        dein Deutsch.
      </p>

      <div class="auth-switch" role="group" aria-label="Anmeldemodus">
        <button
          type="button"
          :class="{ active: mode === 'login' }"
          @click="changeMode('login')"
        >
          Anmelden
        </button>
        <button
          type="button"
          :class="{ active: mode === 'register' }"
          @click="changeMode('register')"
        >
          Registrieren
        </button>
      </div>

      <form class="auth-form" @submit.prevent="submit">
        <label>
          <span>E-Mail-Adresse</span>
          <input
            v-model.trim="email"
            type="email"
            autocomplete="email"
            placeholder="name@beispiel.de"
            required
          >
        </label>

        <label>
          <span>Passwort</span>
          <input
            v-model="password"
            type="password"
            :autocomplete="mode === 'login' ? 'current-password' : 'new-password'"
            placeholder="Mindestens 8 Zeichen"
            minlength="8"
            required
          >
        </label>

        <p v-if="errorMessage" class="auth-message error">
          {{ errorMessage }}
        </p>

        <p v-if="successMessage" class="auth-message success">
          {{ successMessage }}
        </p>

        <button class="auth-submit" type="submit" :disabled="loading">
          {{ loading ? 'Bitte warten …' : submitLabel }}
        </button>
      </form>
    </section>
  </main>
</template>

<style scoped>
.auth-page {
  min-height: 100vh;
  display: grid;
  place-items: center;
  padding: 32px 20px;
}

.auth-card {
  width: min(100%, 460px);
  padding: 40px;
  border: 1px solid var(--line);
  border-radius: 24px;
  background: rgba(255, 253, 248, 0.96);
  box-shadow: 0 24px 70px rgba(32, 45, 39, 0.1);
}

.auth-brand {
  display: inline-flex;
  align-items: center;
  gap: 10px;
  margin-bottom: 36px;
}

.auth-brand > span {
  display: grid;
  place-items: center;
  width: 40px;
  height: 40px;
  border-radius: 50%;
  color: white;
  background: var(--forest);
  font-family: Georgia, serif;
  font-size: 22px;
}

.auth-brand strong {
  font-family: Georgia, serif;
  font-size: 18px;
}

.auth-eyebrow {
  margin-bottom: 8px;
  color: var(--forest);
  font-size: 11px;
  font-weight: 800;
  letter-spacing: 0.12em;
  text-transform: uppercase;
}

.auth-card h1 {
  margin-bottom: 14px;
  font-size: clamp(38px, 8vw, 54px);
}

.auth-description {
  margin-bottom: 28px;
  color: var(--muted);
  line-height: 1.6;
}

.auth-switch {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 4px;
  margin-bottom: 24px;
  padding: 4px;
  border-radius: 12px;
  background: var(--sage);
}

.auth-switch button {
  padding: 10px;
  border: 0;
  border-radius: 9px;
  color: var(--muted);
  background: transparent;
  font-weight: 700;
}

.auth-switch button.active {
  color: var(--forest-dark);
  background: var(--surface);
  box-shadow: 0 2px 8px rgba(18, 62, 48, 0.1);
}

.auth-form {
  display: grid;
  gap: 18px;
}

.auth-form label,
.auth-form label > span {
  display: block;
}

.auth-form label > span {
  margin-bottom: 7px;
  font-size: 13px;
  font-weight: 700;
}

.auth-form input {
  width: 100%;
  padding: 13px 14px;
  border: 1px solid var(--line);
  border-radius: 11px;
  outline: none;
  background: white;
  font: inherit;
}

.auth-form input:focus {
  border-color: var(--forest);
  box-shadow: 0 0 0 3px rgba(29, 90, 69, 0.12);
}

.auth-submit {
  min-height: 48px;
  border: 0;
  border-radius: 12px;
  color: white;
  background: var(--forest);
  font-weight: 800;
}

.auth-submit:hover:not(:disabled) {
  background: var(--forest-dark);
}

.auth-submit:disabled {
  opacity: 0.65;
}

.auth-message {
  margin: 0;
  padding: 11px 13px;
  border-radius: 10px;
  font-size: 13px;
  line-height: 1.5;
}

.auth-message.error {
  color: #8a2e2e;
  background: #f8e1df;
}

.auth-message.success {
  color: var(--forest-dark);
  background: var(--sage);
}

@media (max-width: 540px) {
  .auth-card {
    padding: 28px 22px;
  }
}
</style>