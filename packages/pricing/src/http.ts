import { PricingSyncError } from "./model.js";

export interface HttpResponse {
  ok: boolean;
  status: number;
  headers: { get(name: string): string | null };
  body: {
    getReader(): {
      read(): Promise<{ done: boolean; value?: Uint8Array }>;
    };
  } | null;
  json(): Promise<unknown>;
}

export type HttpFetch = (url: string, init?: Record<string, unknown>) => Promise<HttpResponse>;

export interface RetryOptions {
  attempts?: number;
  fetch?: HttpFetch;
  sleep?: (milliseconds: number) => Promise<void>;
  random?: () => number;
}

function retryableStatus(status: number): boolean {
  return status === 408 || status === 425 || status === 429 || status >= 500;
}

function retryDelay(
  response: HttpResponse | undefined,
  attempt: number,
  random: () => number,
): number {
  const retryAfter = response?.headers.get("retry-after");
  if (retryAfter !== null && retryAfter !== undefined) {
    const seconds = Number(retryAfter);
    if (Number.isFinite(seconds) && seconds >= 0) return seconds * 1_000;
    const date = Date.parse(retryAfter);
    if (Number.isFinite(date)) return Math.max(0, date - Date.now());
  }
  return Math.floor(random() * Math.min(30_000, 1_000 * 2 ** (attempt - 1)));
}

export async function fetchWithRetry(
  url: string,
  init: Record<string, unknown> = {},
  options: RetryOptions = {},
): Promise<HttpResponse> {
  const attempts = options.attempts ?? 5;
  const request =
    options.fetch ??
    ((globalThis as unknown as { fetch: HttpFetch }).fetch.bind(globalThis) as HttpFetch);
  const sleep =
    options.sleep ??
    ((milliseconds) =>
      new Promise((resolve) => {
        const timers = globalThis as unknown as {
          setTimeout(callback: () => void, delay: number): unknown;
        };
        timers.setTimeout(resolve, milliseconds);
      }));
  const random = options.random ?? Math.random;
  let lastError: unknown;

  for (let attempt = 1; attempt <= attempts; attempt += 1) {
    let response: HttpResponse | undefined;
    try {
      response = await request(url, init);
      if (response.ok) return response;
      if (!retryableStatus(response.status)) {
        const category =
          response.status === 401 || response.status === 403 ? "authentication" : "source-schema";
        throw new PricingSyncError(
          category,
          `Provider request failed with HTTP ${response.status}: ${url}.`,
          {
            status: response.status,
          },
        );
      }
      lastError = new Error(`HTTP ${response.status}`);
    } catch (error) {
      if (error instanceof PricingSyncError) throw error;
      lastError = error;
    }
    if (attempt < attempts) await sleep(retryDelay(response, attempt, random));
  }

  throw new PricingSyncError(
    "transient-provider",
    `Provider request exhausted ${attempts} attempts: ${url}.`,
    { cause: lastError instanceof Error ? lastError.message : String(lastError) },
  );
}
