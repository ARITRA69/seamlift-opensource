import { SeamtranscodeError } from "../errors";

type Waiting = { start: () => void; cancel: () => void };

/**
 * Runs at most `concurrency` tasks at once; the rest wait their turn. A
 * task whose signal aborts while waiting never starts.
 */
export class Lane {
  active = 0;
  private waiting: Waiting[] = [];

  constructor(readonly concurrency: number) {}

  get pending() {
    return this.waiting.length;
  }

  run<T>(task: () => Promise<T>, signal?: AbortSignal): Promise<T> {
    return new Promise<T>((resolve, reject) => {
      const entry: Waiting = {
        start: () => {
          signal?.removeEventListener("abort", entry.cancel);
          this.active++;
          task()
            .then(resolve, reject)
            .finally(() => {
              this.active--;
              this.next();
            });
        },
        cancel: () => {
          const i = this.waiting.indexOf(entry);
          if (i !== -1) this.waiting.splice(i, 1);
          reject(new SeamtranscodeError("aborted", "Aborted"));
        },
      };
      if (signal?.aborted) return entry.cancel();
      signal?.addEventListener("abort", entry.cancel, { once: true });
      this.waiting.push(entry);
      this.next();
    });
  }

  private next() {
    while (this.active < this.concurrency && this.waiting.length) {
      this.waiting.shift()!.start();
    }
  }
}
