/**
 * Creates a promise that rejects when an AbortSignal is aborted
 * @param signal - The AbortSignal to listen for cancellation
 * @param reason - Optional reason for the cancellation (defaults to 'Request cancelled')
 * @returns A promise that rejects when the signal is aborted
 */
function createAbortPromise(signal?: AbortSignal, reason: string = 'Request cancelled'): Promise<never> {
  return new Promise((_, reject) => {
    signal?.addEventListener('abort', () => {
      reject(new Error(reason));
    });
  });
}

/**
 * Wraps a promise with abort functionality using an AbortSignal
 * @param promise - The promise to wrap with abort functionality
 * @param signal - Optional AbortSignal to cancel the operation
 * @param reason - Optional reason for the cancellation (defaults to 'Request cancelled')
 * @returns A promise that resolves with the original promise or rejects if aborted
 */
export async function withAbort<T>(
  promise: Promise<T>, 
  signal?: AbortSignal, 
  reason?: string
): Promise<T> {
  if (!signal) {
    return promise;
  }

  return Promise.race([
    promise,
    createAbortPromise(signal, reason)
  ]);
}

export async function makeRequestWithRetry<T>(
  url: string,
  options: RequestInit,
  context: string,
  maxRetries: number = 3,
  baseDelay: number = 1000
): Promise<T> {
  let lastError: Error | null = null;

  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      const response = await fetch(url, options);
      
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      const data = await response.json();
      return data as T;
    } catch (error) {
      lastError = error instanceof Error ? error : new Error(String(error));
      
      if (attempt === maxRetries) {
        throw new Error(`Failed to ${context} after ${maxRetries} attempts: ${lastError.message}`);
      }

      // Exponential backoff with jitter
      const delay = baseDelay * Math.pow(2, attempt - 1) + Math.random() * 1000;
      await new Promise(resolve => setTimeout(resolve, delay));
    }
  }

  throw lastError || new Error(`Failed to ${context}`);
}