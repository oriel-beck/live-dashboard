/**
 * Utility functions for making HTTP requests with retry logic
 */

/**
 * Makes an HTTP request with retry logic for rate limiting and other transient errors
 * @param url - The URL to fetch
 * @param options - Fetch options (headers, method, etc.)
 * @param requestName - Human-readable name for logging
 * @param maxRetries - Maximum number of retry attempts (default: 3)
 * @param baseDelay - Base delay in milliseconds for exponential backoff (default: 1000)
 * @returns Promise with the parsed JSON response
 */
export async function makeRequestWithRetry<T = any>(
  url: string,
  options: RequestInit,
  requestName: string,
  maxRetries: number = 3,
  baseDelay: number = 1000
): Promise<T> {
  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      const response = await fetch(url, options);

      // Check for rate limit
      if (response.status === 429) {
        const retryAfter = getRetryAfter(response) || baseDelay;
        
        if (attempt < maxRetries) {
          console.log(`[RequestUtils] Rate limited for ${requestName}, retrying in ${retryAfter}ms (attempt ${attempt}/${maxRetries})`);
          await delay(retryAfter);
          continue;
        } else {
          throw new Error(`Rate limited after ${maxRetries} attempts for ${requestName}`);
        }
      }

      // Check for other errors
      if (!response.ok) {
        throw new Error(`Failed to fetch ${requestName}: ${response.status} ${response.statusText}`);
      }

      return await response.json() as T;
    } catch (error: any) {
      // If it's a rate limit error and we haven't exhausted retries, continue
      if (error.message?.includes('Rate limited') && attempt < maxRetries) {
        const delayTime = baseDelay * Math.pow(2, attempt - 1); // Exponential backoff
        console.log(`[RequestUtils] Rate limit error for ${requestName}, retrying in ${delayTime}ms (attempt ${attempt}/${maxRetries})`);
        await delay(delayTime);
        continue;
      }

      // For other errors or final attempt, throw the error
      if (attempt === maxRetries) {
        console.error(`[RequestUtils] Error fetching ${requestName} after ${maxRetries} attempts:`, error);
        throw new Error(`Failed to fetch ${requestName}: ${error.message || 'Unknown error'}`);
      }
    }
  }
  throw new Error(`Failed to fetch ${requestName} after ${maxRetries} attempts`);
}

/**
 * Extracts the retry-after value from a response header
 * @param response - The fetch response
 * @returns The retry-after value in milliseconds, or null if not found
 */
function getRetryAfter(response: Response): number | null {
  const retryAfter = response.headers.get('Retry-After');
  if (!retryAfter) return null;
  
  // Retry-After can be either seconds or HTTP date
  const retryAfterNum = parseInt(retryAfter, 10);
  if (!isNaN(retryAfterNum)) {
    return retryAfterNum * 1000; // Convert seconds to milliseconds
  }
  
  // Try to parse as HTTP date
  const retryAfterDate = new Date(retryAfter);
  if (!isNaN(retryAfterDate.getTime())) {
    const now = Date.now();
    const diff = retryAfterDate.getTime() - now;
    return Math.max(0, diff); // Ensure non-negative
  }
  
  return null;
}

/**
 * Delays execution for the specified number of milliseconds
 * @param ms - Milliseconds to delay
 */
function delay(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}
