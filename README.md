# knekro-hub

Web hub para la comunidad de Knekro — biblioteca de juegos jugados en stream + sección GOTY.

**Stack:** Astro (SSR) · Supabase (datos + Twitch OAuth) · Vercel · Tailwind v4.

```bash
npm install
npm run dev      # http://localhost:4321
npm run build
```

Env vars ya configuradas en Vercel (`PUBLIC_SUPABASE_*`). No hace falta añadirlas de nuevo.

## Documentation

- **[AGENTS.md](AGENTS.md)** — read first (AI agents + contributors): rules & conventions.
- **[ARCHITECTURE.md](ARCHITECTURE.md)** — system map, modules, risks.
- **[docs/INDEX.md](docs/INDEX.md)** — full token-optimized doc set (modules, query optimization, GOTY, ADRs).
