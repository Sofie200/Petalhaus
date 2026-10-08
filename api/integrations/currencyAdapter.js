import { z } from 'zod';
import { fetchJson } from './_lib/fetchJson.js';

const BASE_URL = process.env.SUPPLIER_API_URL ?? 'https://api.frankfurter.dev/v1';
const TIMEOUT_MS = Number(process.env.SUPPLIER_API_TIMEOUT_MS ?? 5000);

const FrankfurterRates = z.object({
    amount: z.number(),
    base: z.string(),
    date: z.string(),
    rates: z.record(z.string(), z.number().nonnegative()),
});

// https://api.frankfurter.dev/v1/latest?base=SEK&symbols=SEK,USD,EUR

export async function getRates(base = 'SEK', symbols = ['DKK', 'NOK', 'EUR'])  {
    const url = new URL(`${BASE_URL}/latest`)
    url.searchParams.set('base', base)
    url.searchParams.set('symbols', symbols.join(','))
    
    try {

        const data = await fetchJson(url.toString(), { timeoutMs: TIMEOUT_MS });

        const parsed = FrankfurterRates.safeParse(data);

        if (!parsed.success) {
            throw new Error(`Frankfurter responded with an unexpected format:\n${z.prettifyError(parsed.error)}`);
        }        
        
        return {
          base: data.base,
          date: data.date,
          rates: data.rates
        }
        
    } catch(err) {
        throw new Error(`Something when wrong`);
    }
}