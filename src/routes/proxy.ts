import { Hono } from "hono";
import type { ServerContext } from "../config/context.js";

const proxyRouter = new Hono<ServerContext>();

const corsHeaders = {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Methods": "GET, OPTIONS",
    "Access-Control-Allow-Headers": "*",
};

const CDN_HEADERS = {
    Accept: "*/*",
    "Accept-Language": "en-US,en;q=0.5",
    Origin: "https://hianime.to",
    Referer: "https://hianime.to/",
    "User-Agent":
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/141.0.0.0 Safari/537.36",
};

proxyRouter.options("/", (c) => {
    return c.body(null, { status: 204, headers: corsHeaders });
});

// /api/v2/proxy?url=<encoded_url>
// When IPROYAL_PROXY_URL is set (Railway env), requests go through IPRoyal residential proxy to avoid CDN 403.
proxyRouter.get("/", async (c) => {
    try {
        const url = c.req.query("url");
        if (!url) {
            return c.json({ error: "URL parameter is required" }, 400, corsHeaders);
        }
        const targetUrl = decodeURIComponent(url);
        try {
            new URL(targetUrl);
        } catch {
            return c.json({ error: "Invalid URL" }, 400, corsHeaders);
        }

        const proxyUrl = process.env.IPROYAL_PROXY_URL;
        let response: Response;

        if (proxyUrl) {
            const undici = await import("undici");
            const agent = new undici.ProxyAgent(proxyUrl);
            response = await undici.fetch(targetUrl, {
                dispatcher: agent as any,
                headers: CDN_HEADERS,
            });
        } else {
            response = await fetch(targetUrl, { headers: CDN_HEADERS });
        }

        if (!response.ok) {
            console.error(`[Proxy] ${targetUrl} ${response.status}`);
            return c.json(
                { error: `Upstream: ${response.status} ${response.statusText}` },
                502,
                corsHeaders
            );
        }

        const contentType =
            response.headers.get("content-type") || "application/octet-stream";
        const isM3u8 =
            targetUrl.includes(".m3u8") ||
            contentType.includes("application/vnd.apple.mpegurl") ||
            contentType.includes("application/x-mpegURL") ||
            contentType.includes("mpegurl");

        if (isM3u8) {
            const text = await response.text();
            const baseUrl = targetUrl.substring(0, targetUrl.lastIndexOf("/") + 1);
            const protocol = c.req.header("x-forwarded-proto") || "https";
            const host = c.req.header("host") || "localhost:4000";
            const proxyBase = `${protocol}://${host}/api/v2/proxy`;
            const rewritten = text
                .split("\n")
                .map((line) => {
                    const t = line.trim();
                    if (!t || t.startsWith("#")) return line;
                    let segmentUrl = t;
                    if (
                        !segmentUrl.startsWith("http://") &&
                        !segmentUrl.startsWith("https://")
                    ) {
                        segmentUrl = baseUrl + segmentUrl;
                    }
                    return `${proxyBase}?url=${encodeURIComponent(segmentUrl)}`;
                })
                .join("\n");
            return c.body(rewritten, {
                status: 200,
                headers: {
                    "Content-Type": "application/vnd.apple.mpegurl",
                    "Cache-Control": "no-cache",
                    ...corsHeaders,
                },
            });
        }

        const body = await response.arrayBuffer();
        return c.body(body, {
            status: 200,
            headers: {
                "Content-Type": contentType,
                "Cache-Control": "public, max-age=3600",
                ...corsHeaders,
            },
        });
    } catch (error) {
        console.error("[Proxy Error]", error);
        return c.json(
            {
                error:
                    error instanceof Error ? error.message : "Proxy request failed",
            },
            500,
            corsHeaders
        );
    }
});

export { proxyRouter };
