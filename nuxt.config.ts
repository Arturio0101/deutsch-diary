export default defineNuxtConfig({
  compatibilityDate: '2026-07-17',

  devtools: {
    enabled: true
  },

  css: ['~/assets/css/main.css'],

  runtimeConfig: {
    // Доступен только серверной части Nuxt.
    openaiApiKey: '',

    // Эти параметры доступны браузеру.
    public: {
      supabaseUrl: '',
      supabasePublishableKey: ''
    }
  },

  app: {
    head: {
      htmlAttrs: {
        lang: 'de'
      },

      title: 'Deutsch Diary',

      meta: [
        {
          name: 'description',
          content: 'Persönliches Tagebuch zum Schreiben und Deutschlernen.'
        },
        {
          name: 'theme-color',
          content: '#f7f4ed'
        }
      ]
    }
  }
})