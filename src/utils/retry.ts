import { logError } from "./logger";

interface RetryOptions {
  maxRetries?: number;
  backoffs?: number[];
  operationName?: string;
  timeout?: number;
  shouldRetry?: (error: any) => boolean;
}

export async function withRetry<T>(
  operation: (signal?: AbortSignal) => Promise<T>,
  options: RetryOptions = {}
): Promise<T> {
  const maxRetries = options.maxRetries ?? 2;
  const backoffs = options.backoffs ?? [100, 200];
  const opName = options.operationName ?? "Operation";
  const timeoutMs = options.timeout;
  const shouldRetry = options.shouldRetry ?? (() => true);
  
  let lastError: any;

  for (let i = 0; i <= maxRetries; i++) {
    const controller = new AbortController();
    let timeout: ReturnType<typeof setTimeout> | undefined;

    try {
      if (timeoutMs) {
        timeout = setTimeout(() => {
          controller.abort();
        }, timeoutMs);

        const result = await Promise.race([
          operation(controller.signal),
          new Promise<never>((_, reject) => {
            controller.signal.addEventListener("abort", () => {
              reject(new Error(`${opName} timed out after ${timeoutMs}ms`));
            });
          })
        ]);
        
        if (timeout) clearTimeout(timeout);
        return result;
      }
      
      return await operation();
    } catch (error: any) {
      if (timeout) clearTimeout(timeout);
      lastError = error;
      
      if (!shouldRetry(error)) {
        throw error;
      }

      const attempt = i + 1;
      const totalAttempts = maxRetries + 1;
      
      if (i < maxRetries) {
        logError(`${opName} attempt ${attempt}/${totalAttempts} failed`, error);
        const delay = backoffs[i] ?? backoffs[backoffs.length - 1] ?? 200;
        await new Promise((resolve) => setTimeout(resolve, delay));
      }
    }
  }

  logError(`${opName} failed after ${maxRetries} retries`, lastError);
  throw lastError;
}
