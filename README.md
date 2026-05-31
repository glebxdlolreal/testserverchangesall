# testserverchangesall

Automated snapshot repository for **Telegram test server** resources. A background worker periodically fetches pages and files from all five subdomains (`b-`, `i-`, `l-`, `a-`, `y-`), strips volatile data, and commits changes here — building a full history of test environment web resource changes.

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
└── help.getAppConfig.json     # Snapshot of Telegram MTProto method help.getAppConfig
```

Each folder corresponds to one test server subdomain. Files inside — HTML, JS, CSS, JSON, images — are updated whenever their content changes.

---

## Content normalization

Before comparison and saving, the following volatile data is stripped so commits reflect only real changes:

- `<time>` tags
- Query params: `?hash=`, `?token=`, `passport_ssid=`, `nonce`
- Versioned cache-buster suffixes on JS/CSS (e.g. `?12345_67890`)
- HTML comments like `<!-- page generated in N ms -->`
- IP addresses in the format `X.X.X.X:8888`
- Signature fields `sig=` and `se=` in config strings

`help.getAppConfig.json` is compared with noisy fields excluded (`hash`, `ton_usd_rate`), so only meaningful config changes trigger a commit.

---

## Related repositories

| Repository | Description |
|---|---|
| [prodserverchangesall](https://github.com/glebxdlolreal/prodserverchangesall) | Production server snapshots |
