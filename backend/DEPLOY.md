# Deploying the BasketWise API to hpsrv

hpsrv **serves only**. It never scrapes and never post-processes — it receives a
finished 52 MB SQLite artifact and answers requests from it. Steady state is ~250 MB.

## One-time setup

Data and code are already synced to `/srv/basketwise` (`data/` + `app/`).

### 1. Start the API

```bash
ssh hpsrv@hpsrv
cd /srv/basketwise/app
docker compose build api && docker compose up -d api
curl -s http://$(docker inspect -f '{{range .NetworkSettings.Networks}}{{.IPAddress}}{{end}}' basketwise-api):8000/health | head -c 300
docker stats --no-stream basketwise-api          # expect < 300 MB
```

The container publishes **no host port** — it is reachable only on its own Docker
network, and after step 2, through the tunnel.

### 2. Create the Cloudflare Tunnel

This needs your Cloudflare account, so it is yours to run. Do **not** reuse the
kniageo tunnel — that one serves production `kniamaps.com` and a shared config file
is a shared blast radius.

In the Cloudflare dashboard: **Zero Trust → Networks → Tunnels → Create a tunnel**
→ Cloudflared → name it `basketwise` → copy the token.

> `api.taskglass.work` was already taken, so this deployment uses **`basket`**.

Add a **public hostname** on that tunnel:

| Field | Value |
|---|---|
| Subdomain | `basket` |
| Domain | `taskglass.work` |
| Service | `HTTP` → `api:8000` |

`api:8000` is the container's name on the compose network, which is why no host
port is needed. Cloudflare creates the `basket.taskglass.work` DNS record for you.

Then on hpsrv:

```bash
cd /srv/basketwise/app
printf 'CLOUDFLARE_TUNNEL_TOKEN=%s\n' 'PASTE_TOKEN_HERE' > .env
chmod 600 .env
docker compose up -d
curl -s https://basket.taskglass.work/health
```

This is a **named** tunnel, so `basket.taskglass.work` is stable across restarts and
reboots forever. A quick tunnel (`trycloudflare.com`) would hand out a new random
hostname every restart and break the frontend contract.

### 3. Lock down CORS once the frontend has a domain

While `*`, any site can call the API. It is public read-only data so this is not a
leak, but narrow it when you know the origin:

```bash
echo 'BASKETWISE_CORS=https://basketwise.pages.dev,http://localhost:5173' >> .env
docker compose up -d api
```

## Daily updates

Run on the **build machine**, not hpsrv:

```bash
scraper/deploy/nightly.sh              # crawl, canonicalise, validate, ship
scraper/deploy/nightly.sh --no-crawl   # rebuild + ship from existing crawl data
```

It refuses to ship a bad artifact — if the product count drops more than 20%, or a
retailer disappears, or fewer than 2,000 products are comparable, it aborts and
hpsrv keeps serving yesterday's data.

Schedule it on the Mac with launchd (03:30 daily):

```bash
cat > ~/Library/LaunchAgents/work.taskglass.basketwise.plist <<'PLIST'
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0"><dict>
  <key>Label</key><string>work.taskglass.basketwise</string>
  <key>ProgramArguments</key><array>
    <string>/bin/bash</string>
    <string>-lc</string>
    <string>~/Sync/uni/Devsoc/TP26T2/basketwise/scraper/deploy/nightly.sh</string>
  </array>
  <key>StartCalendarInterval</key><dict><key>Hour</key><integer>3</integer><key>Minute</key><integer>30</integer></dict>
  <key>StandardOutPath</key><string>/tmp/basketwise-nightly.log</string>
  <key>StandardErrorPath</key><string>/tmp/basketwise-nightly.err</string>
</dict></plist>
PLIST
launchctl load ~/Library/LaunchAgents/work.taskglass.basketwise.plist
```

The Mac being asleep is not an outage: hpsrv keeps serving the last good artifact.

## Security posture

- No inbound port on hpsrv. The tunnel dials out; nothing new listens publicly.
- Container is non-root (uid 10001), `read_only`, `cap_drop: ALL`,
  `no-new-privileges`, `mem_limit: 512m`, `pids_limit: 128`.
- The database is mounted `:ro` **and** opened `mode=ro&immutable=1`, so the
  process cannot write to the data it serves even if the app is compromised.
- No auth means no credentials to leak. The only secret on the box is the tunnel
  token in `.env` (mode 600). Rate limiting and bot protection belong at the
  Cloudflare edge, not in application code.

## Rollback

```bash
cd /srv/basketwise/app && docker compose down          # take the API offline
docker compose up -d                                   # bring it back
```

The artifact is a single file. Keep a copy before a risky rebuild:

```bash
ssh hpsrv@hpsrv 'cp /srv/basketwise/data/basketwise.db /srv/basketwise/data/basketwise.db.prev'
```
