/**
 * Async utility functions and helpers
 */

export class AsyncHelpers {
  /**
   * Retry an async operation with exponential backoff
   */
  public static async retry<T>(
    operation: () => Promise<T>,
    options: RetryOptions = {}
  ): Promise<T> {
    const {
      maxAttempts = 3,
      baseDelay = 1000,
      maxDelay = 10000,
      exponentialBase = 2,
    } = options;

    let lastError: Error = new Error("Retry operation failed");

    for (let attempt = 1; attempt <= maxAttempts; attempt++) {
      try {
        return await operation();
      } catch (error) {
        lastError = error as Error;

        if (attempt === maxAttempts) {
          throw lastError;
        }

        const delay = Math.min(
          baseDelay * Math.pow(exponentialBase, attempt - 1),
          maxDelay
        );

        await this.delay(delay);
      }
    }

    throw lastError || new Error("Retry operation failed");
  }

  /**
   * Create a delay promise
   */
  public static delay(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }

  /**
   * Race multiple promises with a timeout
   */
  public static async timeout<T>(
    promise: Promise<T>,
    timeoutMs: number,
    errorMessage = "Operation timed out"
  ): Promise<T> {
    const timeoutPromise = new Promise<never>((_, reject) => {
      setTimeout(() => reject(new Error(errorMessage)), timeoutMs);
    });

    return Promise.race([promise, timeoutPromise]);
  }

  /**
   * Execute promises in batches to avoid overwhelming resources
   */
  public static async batch<T, R>(
    items: T[],
    processor: (item: T) => Promise<R>,
    batchSize: number = 10
  ): Promise<R[]> {
    const results: R[] = [];

    for (let i = 0; i < items.length; i += batchSize) {
      const batch = items.slice(i, i + batchSize);
      const batchResults = await Promise.all(batch.map(processor));
      results.push(...batchResults);
    }

    return results;
  }

  /**
   * Throttle async function calls
   */
  public static throttle<T extends unknown[], R>(
    fn: (...args: T) => Promise<R>,
    limitMs: number
  ): (...args: T) => Promise<R> {
    let lastCall = 0;

    return async (...args: T): Promise<R> => {
      const now = Date.now();
      const timeSinceLastCall = now - lastCall;

      if (timeSinceLastCall < limitMs) {
        await this.delay(limitMs - timeSinceLastCall);
      }

      lastCall = Date.now();
      return fn(...args);
    };
  }
}

export interface RetryOptions {
  maxAttempts?: number;
  baseDelay?: number;
  maxDelay?: number;
  exponentialBase?: number;
}
