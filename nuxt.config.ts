export default defineNuxtConfig({
  compatibilityDate: '2026-07-17',

  devtools: {
    enabled: true
  },

  modules: ['@vite-pwa/nuxt'],

  css: ['~/assets/css/main.css'],

  runtimeConfig: {
    openaiApiKey: '',

    public: {
      supabaseUrl: '',
      supabasePublishableKey: ''
    }
  },

  pwa: {
    registerType: 'autoUpdate',

    client: {
      installPrompt: true
    },

    manifest: {
      id: '/',
      name: 'Deutsch Diary',
      short_name: 'Deutsch Diary',
      description:
        'Persönliches Tagebuch zum Schreiben und Deutschlernen.',
      lang: 'de',
      start_url: '/',
      scope: '/',
      display: 'standalone',
      orientation: 'portrait-primary',
      theme_color: '#f7f4ed',
      background_color: '#f7f4ed',
      categories: ['education', 'lifestyle'],

      icons: [
        {
          src: '/icons/icon-192.png',
          sizes: '192x192',
          type: 'image/png',
          purpose: 'any'
        },
        {
          src: '/icons/icon-512.png',
          sizes: '512x512',
          type: 'image/png',
          purpose: 'any'
        },
        {
          src: '/icons/icon-512.png',
          sizes: '512x512',
          type: 'image/png',
          purpose: 'maskable'
        }
      ]
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
          content:
            'Persönliches Tagebuch zum Schreiben und Deutschlernen.'
        },
        {
          name: 'theme-color',
          content: '#f7f4ed'
        },
        {
          name: 'apple-mobile-web-app-capable',
          content: 'yes'
        },
        {
          name: 'apple-mobile-web-app-status-bar-style',
          content: 'default'
        },
        {
          name: 'apple-mobile-web-app-title',
          content: 'Deutsch Diary'
        }
      ],

      link: [
        {
          rel: 'icon',
          type: 'image/png',
          sizes: '192x192',
          href: '/icons/icon-192.png'
        },
        {
          rel: 'apple-touch-icon',
          href: '/icons/icon-192.png'
        }
      ]
    }
  }
})