/**
 * Simple rolling-window rate limiter.
 *
 * Used by the DeepSeek provider when the user enables rate limiting in the
 * Settings UI. Tracks the timestamps of recent requests; if the next request
 * would exceed `requestsPerSecond` within the trailing 1000ms window, awaits
 * just long enough that the oldest in-window request rolls off, then proceeds.
 *
 * One module-level instance is fine for this app — it's a single-user local
 * tool with one in-flight LLM stream at most.
 */

class RateLimiter {
  private timestamps: number[] = [];

  async acquire(requestsPerSecond: number): Promise<void> {
    if (requestsPerSecond <= 0) return;
    const now = Date.now();
    const windowStart = now - 1000;
    this.timestamps = this.timestamps.filter((t) => t > windowStart);

    if (this.timestamps.length < requestsPerSecond) {
      this.timestamps.push(now);
      return;
    }

    const oldest = this.timestamps[0];
    const waitMs = oldest + 1000 - now;
    if (waitMs > 0) await new Promise((r) => setTimeout(r, waitMs));

    const after = Date.now();
    this.timestamps = this.timestamps.filter((t) => t > after - 1000);
    this.timestamps.push(after);
  }

  reset(): void {
    this.timestamps = [];
  }
}

export const rateLimiter = new RateLimiter();
