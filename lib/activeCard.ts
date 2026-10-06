let active: number | null = null;
let listener: ((value: number | null) => void) | null = null;

export function publishActiveCard(next: number | null): void {
  if (next === active) return;
  active = next;
  listener?.(next);
}

export function subscribeActiveCard(fn: (value: number | null) => void): () => void {
  listener = fn;
  return () => {
    if (listener === fn) listener = null;
  };
}
