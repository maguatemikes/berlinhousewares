import {useEffect, useRef, useSyncExternalStore} from 'react';

export type CartLineRef = {
  id: string;
  quantity: number;
  /** True while this is an optimistic line not yet confirmed by Shopify —
   *  its id is synthetic, so update/remove must wait until it's real. */
  isOptimistic?: boolean;
};

/**
 * A tiny external store (NOT a React context) holding a
 * `merchandiseId → {lineId, quantity}` map, so product cards can tell whether a
 * variant is in the cart and drive the inline quantity stepper.
 *
 * Why an external store instead of a context provider: `CartMain` (which holds
 * the Await-resolved + optimistic cart) is INSIDE the cart Aside. If it
 * published through a context provider wrapping the layout, every cart change
 * would re-render the Aside and interrupt its CSS slide-in transition (the
 * drawer would stop animating once it had items). Writing to this store instead
 * only re-renders the subscribing product cards — the Aside is never touched.
 *
 * All writes happen from `usePublishCartLines`'s effect, i.e. client-only, so
 * the module-level state is never written during SSR (no cross-request leak).
 */
const EMPTY_MAP: Map<string, CartLineRef> = new Map();
let currentMap: Map<string, CartLineRef> = EMPTY_MAP;
const listeners = new Set<() => void>();

function subscribe(listener: () => void) {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}
function getSnapshot() {
  return currentMap;
}

/** The cart line for a given variant, or null if it isn't in the cart. */
export function useCartLine(merchandiseId?: string | null): CartLineRef | null {
  const map = useSyncExternalStore(subscribe, getSnapshot, () => EMPTY_MAP);
  return merchandiseId ? map.get(merchandiseId) ?? null : null;
}

/** True when the cart has no lines (used to open the drawer only on the first add). */
export function useCartIsEmpty(): boolean {
  const map = useSyncExternalStore(subscribe, getSnapshot, () => EMPTY_MAP);
  return map.size === 0;
}

type MinimalCart = {
  lines?: {
    nodes?: Array<{
      id?: string;
      quantity: number;
      merchandise?: {id?: string};
      isOptimistic?: boolean;
    }>;
  };
} | null;

/**
 * Publishes the current (optimistic) cart's line map to the store. Call from
 * CartMain with its already-resolved optimistic cart. Only pushes when the
 * logical contents change (signature compare).
 */
export function usePublishCartLines(cart: MinimalCart) {
  const lastSig = useRef<string>('');

  const entries: Array<[string, CartLineRef]> = [];
  for (const line of cart?.lines?.nodes ?? []) {
    const mid = line?.merchandise?.id;
    if (mid && line.id) {
      entries.push([
        mid,
        {id: line.id, quantity: line.quantity, isOptimistic: !!line.isOptimistic},
      ]);
    }
  }
  const sig = entries
    .map(([mid, l]) => `${mid}:${l.id}:${l.quantity}:${l.isOptimistic ? 1 : 0}`)
    .join('|');

  useEffect(() => {
    if (sig === lastSig.current) return;
    lastSig.current = sig;
    currentMap = new Map(entries);
    for (const l of listeners) l();
    // entries is represented by sig; depending on it would churn identity.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sig]);
}
