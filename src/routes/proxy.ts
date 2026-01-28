import { Hono } from "hono";
import type { ServerContext } from "../config/context.js";

const proxyRouter = new Hono<ServerContext>();

// CORS headers for all responses
const corsHeaders = {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Methods": "GET, OPTIONS",
    "Access-Control-Allow-Headers": "*",
};

// Handle OPTIONS preflight requests
proxyRouter.options("/", (c) => {
    return c.body(null, {
        status: 204,
        headers: corsHeaders,
    });
});

// /api/v2/proxy?url=<encoded_url>
proxyRouter.get("/", async (c) => {
    try {
        const url = c.req.query("url");

        if (!url) {
            return c.json({ error: "URL parameter is required" }, 400, corsHeaders);
        }

        // Decode the URL
        const targetUrl = decodeURIComponent(url);

        // Validate URL
        try {
            new URL(targetUrl);
        } catch {
            return c.json({ error: "Invalid URL" }, 400, corsHeaders);
        }

        // Fetch with appropriate headers to bypass blocking
        const response = await fetch(targetUrl, {
            headers: {
                "Referer": "https://hianime.to",
                "Origin": "https://hianime.to",
                "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:122.0) Gecko/20100101 Firefox/122.0",
                "Accept": "*/*",
                "Accept-Language": "en-US,en;q=0.5",
                "Accept-Encoding": "gzip, deflate, br",
            },
        });

        if (!response.ok) {
            console.error(`[Proxy Error] Failed to fetch: ${targetUrl} ${response.status}`);
            return c.json(
                { error: `Failed to fetch: ${response.status} ${response.statusText}` },
                502, // Bad Gateway
                corsHeaders
            );
        }

        // Get content type
        const contentType = response.headers.get("content-type") || "application/octet-stream";

        // Stream the response
        const body = await response.arrayBuffer();

        return c.body(body, {
            status: 200,
            headers: {
                "Content-Type": contentType,
                ...corsHeaders,
                "Cache-Control": "public, max-age=3600",
            },
        });
    } catch (error) {
        console.error("[Proxy Error]", error);
        return c.json(
            { error: error instanceof Error ? error.message : "Proxy request failed" },
            500,
            corsHeaders
        );
    }
});

export { proxyRouter };
