"use client";

import { useMemo, useSyncExternalStore } from "react";
import { dequeue, enqueue, queueName, readQueue, type QueuedCount } from "@/lib/collections";

// Counts waiting on this phone to be sent. Kept in this browser only, per
// person, and removed as soon as the server has them.

const EVENT = "imarah-kutipan-queue";

function store(): Storage | null {
  try {
    return window.localStorage;
  } catch {
    return null;
  }
}

function subscribe(onChange: () => void) {
  window.addEventListener(EVENT, onChange);
  window.addEventListener("storage", onChange);
  return () => {
    window.removeEventListener(EVENT, onChange);
    window.removeEventListener("storage", onChange);
  };
}

const notify = () => window.dispatchEvent(new Event(EVENT));

export function useQueue(userId: string): QueuedCount[] {
  const raw = useSyncExternalStore(
    subscribe,
    () => {
      try {
        return store()?.getItem(queueName(userId)) ?? null;
      } catch {
        return null;
      }
    },
    () => null,
  );
  return useMemo(() => readQueue({ getItem: () => raw, setItem: () => {}, removeItem: () => {} }, userId), [raw, userId]);
}

/** False when the phone would not keep it (for example private browsing). */
export function keepOnPhone(userId: string, item: QueuedCount): boolean {
  const kept = enqueue(store(), userId, item).some((existing) => existing.key === item.key);
  notify();
  return kept;
}

export function forget(userId: string, key: string) {
  dequeue(store(), userId, key);
  notify();
}
