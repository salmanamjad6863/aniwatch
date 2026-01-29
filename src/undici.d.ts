/**
 * Type declarations for 'undici' (used for ProxyAgent when IPROYAL_PROXY_URL is set).
 * Undici ships its own types; this file is a fallback when TS cannot resolve the package.
 */
declare module "undici" {
    export class ProxyAgent {
        constructor(proxyUrl: string);
    }
    export const fetch: typeof globalThis.fetch;
}
