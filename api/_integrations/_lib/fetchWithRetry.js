// Fetch med nya försök vid tillfälliga fel.
// Returnerar Response, så att den som anropar själv väljer hur bodyn läses
// (json, text, arrayBuffer).

const RETRYABLE = new Set([408, 429, 500, 502, 503, 504]); // a Set has a fast has() check
const MAX_ATTEMPTS = 3;

export async function fetchWithRetry(url, { headers = {}, timeoutMs = 5000 } = {}) {
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
      return response;
    }
    if (!RETRYABLE.has(response.status) || attempt === MAX_ATTEMPTS) {
      throw new Error(`Permanent error or out of retries: ${response.status} ${response.statusText}`);
    }

    await response.body?.cancel(); // släpp anslutningen innan nästa försök
    console.warn(`Status ${response.status}, attempt ${attempt} of ${MAX_ATTEMPTS}. Trying again in 1 second.`);
    await new Promise((resolve) => setTimeout(resolve, 1000));
  }
}