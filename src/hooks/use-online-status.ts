/**
 * useOnlineStatus
 * ---------------
 * Single source of truth for connectivity state.
 *
 * Combines:
 *  - `navigator.onLine` + browser 'online'/'offline' events (network layer)
 *  - Periodic lightweight ping to Supabase Auth endpoint while offline
 *    (some networks report online but block traffic)
 *
 * Returns { online, since } where `since` is the timestamp of the last
 * transition, useful to render "reconnecting…" states.
 */
import { useEffect, useState, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";

export interface OnlineStatus {
  online: boolean;
  since: number;
}

export function useOnlineStatus(): OnlineStatus {
  const [state, setState] = useState<OnlineStatus>(() => ({
    online: typeof navigator === "undefined" ? true : navigator.onLine,
    since: Date.now(),
  }));

  const setOnline = useCallback((online: boolean) => {
    setState((prev) => (prev.online === online ? prev : { online, since: Date.now() }));
  }, []);

  useEffect(() => {
    const handleOnline = () => setOnline(true);
    const handleOffline = () => setOnline(false);
    window.addEventListener("online", handleOnline);
    window.addEventListener("offline", handleOffline);

    // While offline, poll every 15s to detect recovery even if the OS
    // fails to fire the 'online' event (common on captive portals).
    let pollId: number | undefined;
    const poll = async () => {
      try {
        // getSession is cheap, local-first, but touches the auth client
        // which will attempt refresh when network returns.
        await supabase.auth.getSession();
        if (navigator.onLine) setOnline(true);
      } catch {
        /* still offline */
      }
    };
    pollId = window.setInterval(() => {
      if (!navigator.onLine) poll();
    }, 15000);

    return () => {
      window.removeEventListener("online", handleOnline);
      window.removeEventListener("offline", handleOffline);
      if (pollId) window.clearInterval(pollId);
    };
  }, [setOnline]);

  return state;
}
