<p align="center">
  <img src="endgame_grocery_logo.png" alt="Endgame Grocery" width="180" />
</p>

<p align="center">
  <img src="https://github.com/DerFloDev/endgame_grocery/actions/workflows/ci.yml/badge.svg" alt="CI" />
  <a href="./LICENSE">
    <img src="https://img.shields.io/badge/License-GPL%20v3-blue.svg" alt="License: GPL v3" />
  </a>
</p>

# endgame_grocery

Shared grocery list monorepo with a React frontend, an Express backend, and PostgreSQL persistence.

Plan, share and tick off groceries together — with live updates, offline support and an installable app.

## Features

<p align="center">
  <img src="assets/demo_lists.png" alt="List overview" width="220" />
  &nbsp;&nbsp;&nbsp;
  <img src="assets/demo_listitems.png" alt="List detail with open items" width="220" />
  &nbsp;&nbsp;&nbsp;
  <img src="assets/demo_add_item.png" alt="Add item with icon picker" width="220" />
</p>

- **Shared lists and invites** — create lists, share them with family or flatmates by email invite and see who is on them.
- **Fast item entry** — add items with optional details (quantity, brand), autocomplete with typo tolerance and a recently used history.
- **Icons for every item** — icons are suggested locally in your browser, so item text never leaves your device. Pick another icon any time.
- **Live updates** — changes by other members appear immediately, without reloading.
- **Notifications** — optional browser push messages when someone adds items to a shared list, batched so they do not spam.
- **Works offline** — installable PWA that shows your lists without a connection and syncs your changes when you are back online. An expired access session shows a [Reconnect action](docs/SETUP.md#expired-access-session-or-cloudflare-challenge-stuck-offline-mode), keeping queued changes.
- **English and German** — follows your browser language and can be switched in the app.
- **Home Assistant and REST API** — integrate with an API key; Swagger documentation is served at `/api/docs/` on a running instance.
- **Accounts and security** — email verification, password reset, rate limiting and hardened security headers.

## Quick start

Run the app with Docker (needs Docker with Compose support):

```bash
cp docker-compose.example.yml docker-compose.yml
# edit docker-compose.yml and replace every "change-me" value
docker compose up -d
```

Then open `http://localhost:80`. Database migrations run automatically on start. See [docs/SETUP.md](docs/SETUP.md) for configuration, push notifications and production hints.

## Documentation

- [Setup](docs/SETUP.md) — install, configure and operate a deployment (Docker, environment variables, push notifications, Cloudflare, security).
- [Development](docs/DEVELOPMENT.md) — local development, tests, CI/CD, architecture and the detailed behavior and API reference.
- API docs — Swagger UI at `/api/docs/` on a running instance.

## Built With

This project is vibe-coded with aide, the AI workflow tooling from [agentinit](https://github.com/riadshalaby/agentinit).

## Support

<a href="https://www.buymeacoffee.com/derflodev">
  <img src="https://cdn.buymeacoffee.com/buttons/v2/default-yellow.png" alt="Buy Me a Coffee" height="40" />
</a>

[![GitHub Sponsors](https://img.shields.io/badge/GitHub%20Sponsors-support-EA4AAA?logo=githubsponsors)](https://github.com/sponsors/DerFloDev)

## License

This project is licensed under the [GNU General Public License v3.0](./LICENSE).
