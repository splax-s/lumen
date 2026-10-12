export type SimEvent = { type: string; value?: string | number; t: number };
export type SimEventInput = { type: string; value?: string | number };

type Listener = (event: SimEvent) => void;

/** Typed publish/subscribe bus that also keeps an ordered log for `done_when` and the tutor. */
export class EventBus {
  private events: SimEvent[] = [];
  private listeners = new Set<Listener>();
  private readonly now: () => number;

  constructor(now: () => number = () => Date.now()) {
    this.now = now;
  }

  emit(event: SimEventInput): void {
    const full: SimEvent =
      event.value === undefined
        ? { type: event.type, t: this.now() }
        : { type: event.type, value: event.value, t: this.now() };
    this.events.push(full);
    for (const listener of [...this.listeners]) {
      try {
        listener(full);
      } catch {
        // One faulty listener must not break the simulation loop.
      }
    }
  }

  on(listener: Listener): () => void {
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  }

  log(): readonly SimEvent[] {
    return this.events;
  }

  /** Distinct values when the events carry values, otherwise the number of occurrences. */
  count(type: string): number {
    const matching = this.events.filter((e) => e.type === type);
    const values = matching.filter((e) => e.value !== undefined).map((e) => e.value);
    return values.length > 0 ? new Set(values).size : matching.length;
  }

  has(type: string, value: string | number): boolean {
    return this.events.some((e) => e.type === type && e.value === value);
  }

  seen(type: string): boolean {
    return this.events.some((e) => e.type === type);
  }

  clear(): void {
    this.events = [];
  }
}
