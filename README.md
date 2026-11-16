# Project Archive

*A personal archive of projects, experiments, and everything built along the way.*

A self-hosted portfolio that brings together past and present projects through a minimal interface and an animated, time-responsive sky.

### Features

- **Public Archive:** Browse projects through hand-outlined cards and individual shareable pages.
- **Admin Dashboard:** Manage projects, media, ordering, and site appearance.
- **Dynamic Sky:** A time-responsive environment featuring sunlight, clouds, birds, moonlight, and stars.
- **Privacy-focused:** No geolocation, IP tracking, weather APIs, or unnecessary data collection.
- **Reduced Motion:** Respects system accessibility preferences.

### Tech Stack

React 19 · TypeScript · Vite · Cloudflare Workers · D1 · R2 · Wrangler

### Architecture

A single Cloudflare Worker serves the frontend and API. D1 handles structured data, while R2 stores project media in private object storage.

### Preview

The public archive is available at `/`, with individual projects accessible through `/p/<slug>` and private administration at `/admin`.

Preview different sky conditions using `?hour=5.5`, `?hour=12`, `?hour=19.5`, or `?hour=23`.

### Development

Requires Node.js 20+ and npm.

See [DEPLOYMENT.md](DEPLOYMENT.md) for local setup, configuration, and deployment instructions.

---

<p align="center">
  <sub>Built to preserve the work, the experiments, and everything in between.</sub>
</p>