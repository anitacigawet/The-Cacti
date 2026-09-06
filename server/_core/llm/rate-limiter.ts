/**
 * Simple rolling-window rate limiter.
 *
 * Shared by all providers when the user enables rate limiting in the
 * Settings UI. Tracks the timestamps of recent requests; if the next request
 * would exceed `requestsPerSecond` within the trailing 1000ms window, awaits
 * just long enough that the oldest in-window request rolls off, then proceeds.
 *
 * Admissions are queued in arrival order so overlapping calls cannot claim
 * the same capacity when a previous request leaves the window.
 */

export class RateLimiter {
  private timestamps: number[] = [];
  private queue: Promise<void> = Promise.resolve();

  async acquire(requestsPerSecond: number): Promise<void> {
    if (requestsPerSecond <= 0) return;
    const admission = this.queue.then(() => this.waitForCapacity(requestsPerSecond));
    this.queue = admission.catch(() => {});
    await admission;
  }

  private async waitForCapacity(requestsPerSecond: number): Promise<void> {
    while (true) {
      const now = Date.now();
      this.timestamps = this.timestamps.filter((t) => t > now - 1000);
      if (this.timestamps.length < requestsPerSecond) {
        this.timestamps.push(now);
        return;
      }
      const waitMs = this.timestamps[0] + 1000 - now;
      await new Promise((resolve) => setTimeout(resolve, waitMs));
    }
  }

  reset(): void {
    this.timestamps = [];
  }
}

export const rateLimiter = new RateLimiter();
