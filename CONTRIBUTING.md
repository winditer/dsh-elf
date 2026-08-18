# Contributing to dsh-elf

Thanks for helping with the elf! The plugin is small on purpose, so the bar for
contributions is low but real.

## Getting started

```sh
git clone https://github.com/winditer/dsh-elf.git && cd dsh-elf
npm install          # esbuild is the only dependency
npm run build        # src/client.js -> dist/client.js (__ModuleLoader__ bundle)
```

Install into a DSH profile to try it:

```sh
dsh plugin --profile desktop add .
```

## Checks that must pass

```sh
npm run check   # node --check on src/client.js and src/host.js
npm test        # node --test: host JSON API contract + client bundle guards
npm run build   # esbuild bundle; must succeed
```

CI runs all three on Node 22 and 24 for every push and PR.

## Architecture at a glance

- `src/host.js` — Node host half (also shipped as `lib/index.js`): registers the
  `/dsh-elf/api` JSON route and streams session-default chats via `llm.stream`.
- `src/client.js` — browser half, bundled to `dist/client.js`: renders into the
  `shell.overlay` slot, talks to the host with `fetch` POSTs.
- `scripts/build.mjs` — esbuild + the `__ModuleLoader__` wrapper.

## Gotchas (learned the hard way)

- **The bundle `load` id must equal the package name.** `scripts/build.mjs`
  derives it from `package.json` and fails the build on drift, so never hardcode
  it elsewhere or rename the package casually.
- **Profile bundles get no cordis `timer` service.** Use plain browser
  `setInterval`/`setTimeout` in the client and dispose them from effect cleanup.
- **Client changes go live on page refresh;** host changes need a full DSH
  restart. `dist/client.js` is a generated artifact and is not committed.

## Submitting changes

- Keep commits small and focused; describe *why* in the message.
- Prefer adding a regression test over documenting a fixed symptom.
- PRs go to `main` and must keep `check`, `test` and `build` green on both
  Node versions in CI.