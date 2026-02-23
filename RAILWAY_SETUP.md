# Railway Setup Guide for aniwatch-api

Reduce 502 errors and timeouts by configuring Redis caching and keep-warm.

---

## 1. Enable Redis Caching (Most Important)

Redis caches scraped data so **repeat requests don't hit HiAnime**—responses return in milliseconds instead of 15+ seconds.

### In Railway Dashboard

1. Open your **aniwatch-api** service
2. Go to **Variables** tab
3. Add:

| Variable | Value |
|----------|-------|
| `ANIWATCH_API_REDIS_CONN_URL` | `redis://default:YOUR_PASSWORD@tramway.proxy.rlwy.net:40903` |

Use your actual Redis URL from Railway (same Redis you use for anime-world).  
Format: `redis://default:PASSWORD@HOST:PORT`

4. **Redeploy** the service

After this, `/search`, `/home`, `/anime/:id/episodes` etc. will be cached for 5 minutes. First request may still timeout; subsequent requests for the same anime will be fast.

---

## 2. Keep Service Warm (Reduce Cold Starts)

Railway can have cold starts after idle periods. Use **UptimeRobot** (free) to ping your API every 5 minutes.

### Setup UptimeRobot

1. Go to [uptimerobot.com](https://uptimerobot.com) and create a free account
2. **Add New Monitor**
   - Monitor Type: **HTTP(s)**
   - Friendly Name: `aniwatch-api keep-warm`
   - URL: `https://YOUR-ANIWATCH-API.up.railway.app/health`
   - Monitoring Interval: **5 minutes**
3. Save

The `/health` endpoint is lightweight and responds quickly, keeping the service warm without triggering heavy scrapes.

---

## 3. Environment Variables for Railway

| Variable | Value | Purpose |
|----------|-------|---------|
| `ANIWATCH_API_REDIS_CONN_URL` | Your Redis URL | Enable caching (see above) |
| `ANIWATCH_API_HOSTNAME` | `aniwatch-api-production-xxxx.up.railway.app` | Enable rate limiting (optional) |
| `ANIWATCH_API_DEPLOYMENT_ENV` | `nodejs` | Default; no change needed |
| `ANIWATCH_API_MAX_REQS` | `70` | Max requests per window (optional) |
| `ANIWATCH_API_WINDOW_MS` | `1800000` | 30 min window (optional) |

---

## 4. What Railway Does NOT Support

- **No configurable timeout** – Railway’s gateway timeout (~15s) cannot be increased
- **No platform setting** – You must optimize the app (caching, faster responses)

---

## 5. Expected Behavior After Setup

| Scenario | Before | After |
|----------|--------|-------|
| First request for "Naruto" | 502 (timeout) | May still timeout if scrape >15s |
| Second request for "Naruto" (within 5 min) | 502 | ✅ Fast (from Redis) |
| After 5 min idle | Cold start, slow | UptimeRobot keeps warm |

---

## 6. If 502s Persist

1. **Check Redis** – Verify `ANIWATCH_API_REDIS_CONN_URL` is correct and Redis is reachable from Railway
2. **Check logs** – Railway → aniwatch-api → Logs for errors
3. **HiAnime slowness** – If HiAnime.to is slow, first requests will keep failing; caching helps repeat traffic
4. **Upgrade plan** – Railway Pro may have different timeout behavior (check Railway docs)
