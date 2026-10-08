/**
 * Extra: retries on temporary errors
 * (instruktionskommentaren kan ligga kvar oförändrad här)
 */

const RETRYABLE = new Set([408, 429, 500, 502, 503, 504]); // a Set has a fast has() check
const MAX_ATTEMPTS = 3;

/**
 * @param {string} url
 * @param {{ headers?: Record<string, string>, timeoutMs?: number }} [options]
 * @returns {Promise<unknown>}
 */
export async function fetchJson(url, { headers = {}, timeoutMs = 5000 } = {}) {
  for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt++) {
    let response;
    try {
      response = await fetch(url, {
        headers,
        signal: AbortSignal.timeout(timeoutMs), // Timeout when response is too slow
      });
    } catch (err) {
      // fetch throws when we get no response at all. Say what happened, in plain words.
      if (err instanceof Error && err.name === "TimeoutError") {
        throw new Error(`No response from ${url} within ${timeoutMs} ms (timeout)`);
      }
      throw new Error(`Could not reach ${url} (network error)`, { cause: err });
    }

    if (response.ok) {
      return response.json();
    }
    if (!RETRYABLE.has(response.status) || attempt === MAX_ATTEMPTS) {
      throw new Error(`Permanent error or out of retries: ${response.status} ${response.statusText}`);
    }

    console.warn(`Status ${response.status}, attempt ${attempt} of ${MAX_ATTEMPTS}. Trying again in 1 second.`);
    await new Promise((resolve) => setTimeout(resolve, 1000));
  }
}