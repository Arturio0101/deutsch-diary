# Deutsch Diary

Personal German learning diary with AI-powered corrections and vocabulary.

The first milestone contains the Nuxt foundation and a responsive diary editor with:

- B1, B2, and C1 target-level selection;
- minimal, natural, and level-adjusted correction modes;
- a live word counter;
- a mobile-first layout prepared for PWA support.

AI processing, authentication, persistence, and voice input will be added in later milestones.

## Requirements

- Node.js 20 or newer
- npm

## Local development

```bash
npm install
npm run dev
```

Open `http://localhost:3000`.

## Production build

```bash
npm run build
npm run preview
```

## Environment variables

Copy `.env.example` to `.env` only when integrations are added. Never commit `.env` files or API keys.
