# testserverchangesall

Automated snapshot repository for **Telegram test server** resources: web pages, static files, and selected Telegram API responses. Changes are normalized and committed here to preserve their history. Test web resources are grouped by subdomain (`a-`, `b-`, `i-`, `l-`, `y-`).

The equivalent repository for the **production** server: [prodserverchangesall](https://github.com/glebxdlolreal/prodserverchangesall)

---

## Repository structure

```
testserverchangesall/
├── a-/                        # Resources from subdomain a-*
├── b-/                        # Resources from subdomain b-*
├── i-/                        # Resources from subdomain i-*
├── l-/                        # Resources from subdomain l-*
├── y-/                        # Resources from subdomain y-*
├── help.getAppConfig.json     # Application configuration snapshot
└── <namespace>.<method>.json  # Other selected Telegram API responses
```

Each folder corresponds to one test server subdomain. Files inside — HTML, JS, CSS, JSON, images — are updated whenever their content changes. Telegram API snapshots are stored at the repository root, separately from web resources.

---

## Telegram API snapshots

Selected responses cover application and server configuration, countries and time zones, Premium information, theme backdrops, interest categories, transcription models, wallet rates and provider information. A snapshot appears when the corresponding method is available on the server.

`aicompose.getTones.json` contains only system AI compose styles. User-created styles and their authors are excluded.

---

## Content normalization

Before comparison and saving, the following volatile data is stripped so commits reflect only real changes:

- `<time>` tags
- Query params: `?hash=`, `?token=`, `passport_ssid=`, `nonce`
- Versioned cache-buster suffixes on JS/CSS (e.g. `?12345_67890`)
- HTML comments like `<!-- page generated in N ms -->`
- IP addresses in the format `X.X.X.X:8888`
- Signature fields `sig=` and `se=` in config strings

`help.getAppConfig.json` is compared with noisy fields excluded (`hash`, `ton_usd_rate`), so only meaningful config changes trigger a commit. Other API snapshots also filter volatile fields and account-specific data before saving.

---

## Related repositories

| Repository | Description |
|---|---|
| [prodserverchangesall](https://github.com/glebxdlolreal/prodserverchangesall) | Production server snapshots |
