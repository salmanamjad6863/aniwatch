/**
 * Type declarations for 'undici' (optional dependency).
 * Undici ships its own types; this file is a fallback when TS cannot resolve the package.
 */
declare module "undici" {
    export class ProxyAgent {
        constructor(proxyUrl: string);
    }
    export const fetch: typeof globalThis.fetch;
}
