# 🚀 Focus Rocket

App di produttività personale con focus timer, task breakdown AI, musica integrata, metriche di progresso e body doubling AI.

## 🌐 Live Demo

https://[TUO-USERNAME].github.io/focus-rocket/

## 📁 Struttura

```
focus-rocket/
├── index.html          # Shell DOM
├── css/
│   └── app.css         # Stili completi
├── js/
│   ├── db.js           # IndexedDB layer + Supabase sync
│   ├── app.js          # Core: AudioEngine, state, FX
│   ├── init.js         # DOMContentLoaded
│   ├── metrics.js      # Dashboard, calendario, grafici
│   ├── settings.js     # Settings panel, sound FX
│   ├── music.js        # Music player, YouTube embeds
│   ├── leaderboard.js  # Classifiche, livelli
│   ├── tasks.js        # Task breakdown AI
│   ├── timer.js        # Pomodoro timer
│   └── bd-ai.js        # Body Doubling AI
└── .github/
    └── workflows/
        └── deploy.yml  # CI/CD GitHub Pages
```

## 🛠️ Stack

- **Frontend**: Vanilla JS (ES6+), modular architecture
- **Storage**: IndexedDB (Dexie.js) + Supabase (cloud sync)
- **Styling**: CSS custom properties, dark/light theme
- **Deploy**: GitHub Pages + GitHub Actions

## 🚀 Deploy

Ogni push su `main` triggera il deploy automatico.

## 📋 Roadmap

- [x] Blocco 7.0 — Refactoring modulare
- [x] Blocco 7.1 — IndexedDB layer
- [ ] Blocco 7.2 — Supabase auth & sync
- [ ] Blocco 7.3 — API proxy OpenAI
- [ ] Blocco 8.0 — Monetizzazione

## 📄 License

MIT
