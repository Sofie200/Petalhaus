import { z } from 'zod';
import { fetchWithRetry } from './_lib/fetchWithRetry.js';

const BASE_URL = process.env.CURRENCY_API_URL ?? 'https://api.frankfurter.dev/v1';
const TIMEOUT_MS = Number(process.env.CURRENCY_API_TIMEOUT_MS ?? 5000);
const CACHE_MS = Number(process.env.CURRENCY_CACHE_SECONDS ?? 7200) * 1000;

const BASE = 'SEK';
const SYMBOLS = ['DKK', 'NOK', 'EUR'];

const FrankfurterRates = z.object({
    amount: z.number(),
    base: z.string(),
    date: z.string(),
    rates: z.record(z.string(), z.number().nonnegative()),
});

// https://api.frankfurter.dev/v1/latest?base=SEK&symbols=DKK,NOK,EUR

export async function fetchRates() {
    const url = new URL(`${BASE_URL}/latest`);
    url.searchParams.set('base', BASE);
    url.searchParams.set('symbols', SYMBOLS.join(','));

    try {
        const response = await fetchWithRetry(url.toString(), { timeoutMs: TIMEOUT_MS });
        const data = await response.json();

        const parsed = FrankfurterRates.safeParse(data);
        if (!parsed.success) {
            throw new Error(`Frankfurter responded with an unexpected format:\n${z.prettifyError(parsed.error)}`);
        }

        const { base, date, rates } = parsed.data;
        return { base, date, rates };

    } catch (err) {
        throw new Error(`Could not fetch currency rates: ${err.message}`, { cause: err });
    }
}

let cache = null; // { value, expiresAt } | null

export async function getRates() {
    if (cache && cache.expiresAt > Date.now()) {
        return { ...cache.value, fromCache: true };
    }

    const value = {
        ...(await fetchRates()),
        fetchedAt: new Date().toISOString(),
    };
    cache = { value, expiresAt: Date.now() + CACHE_MS };
    return { ...value, fromCache: false };
}