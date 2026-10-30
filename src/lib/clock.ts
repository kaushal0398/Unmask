/**
 * The page's clock. It is the real time unless a presenter changes it: the demo panel can speed it up or skip ahead
 * so a recording never waits on a real countdown. Every countdown and every launch stage reads this clock.
 * Client only: the pages are prerendered, so nothing on the server may depend on the time.
 */
type State = { speed: number; anchorReal: number; anchorVirtual: number };

let state: State | null = null;
let version = 0;
let opened: number | null = null;
const listeners = new Set<() => void>();

const ensure = (): State => (state ??= { speed: 1, anchorReal: Date.now(), anchorVirtual: Date.now() });
const emit = () => {
  version++;
  listeners.forEach((l) => l());
};

export const clock = {
  /** The page's current time, in ms. */
  now(): number {
    const s = ensure();
    return s.anchorVirtual + (Date.now() - s.anchorReal) * s.speed;
  },
  get speed() {
    return ensure().speed;
  },
  /** Run the clock faster (or 1 for real time). The time does not jump. */
  setSpeed(speed: number) {
    state = { speed, anchorReal: Date.now(), anchorVirtual: clock.now() };
    emit();
  },
  /** Jump the clock forward. */
  skip(ms: number) {
    const s = ensure();
    state = { ...s, anchorReal: Date.now(), anchorVirtual: clock.now() + ms };
    emit();
  },
  /** Back to the real time and real speed. */
  reset() {
    state = { speed: 1, anchorReal: Date.now(), anchorVirtual: Date.now() };
    emit();
  },
  subscribe(listener: () => void) {
    listeners.add(listener);
    return () => listeners.delete(listener);
  },
  /** When the page was opened, on this clock. Fixed for the session, so a countdown and the mock API agree on it. */
  sessionStart(): number {
    return (opened ??= clock.now());
  },
  /** Changes whenever the speed or the position is changed by hand. */
  version: () => version,
};
