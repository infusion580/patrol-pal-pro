/**
 * useRealtimeTable
 * ----------------
 * Subscribe a component to changes on a table through the shared realtime
 * manager (one socket channel per table, shared by every consumer).
 *
 * The callback is also fired once after the app regains connectivity or the
 * tab becomes visible again, so screens re-sync data missed while suspended.
 */
import { useEffect, useRef } from 'react';
import { subscribeTable } from '@/lib/realtime';

export function useRealtimeTable(
  table: string,
  onChange: () => void,
  options?: { filter?: string; enabled?: boolean },
) {
  const cb = useRef(onChange);
  cb.current = onChange;

  const { filter, enabled = true } = options ?? {};

  useEffect(() => {
    if (!enabled) return;
    return subscribeTable(table, () => cb.current(), filter);
  }, [table, filter, enabled]);
}
