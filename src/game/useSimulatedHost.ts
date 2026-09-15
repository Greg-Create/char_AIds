import { useEffect, useRef } from 'react';

/**
 * Stand-in for the party host's actions when this device is a guest.
 *
 * There is no backend yet, so instead of waiting on a real "host pressed SPIN"
 * message we simply fire `action` after `delayMs`. When multiplayer sync lands,
 * replace the timeout with a subscription to the party channel and call
 * `action` when the host's event arrives.
 */
export function useSimulatedHost(active: boolean, delayMs: number, action: () => void) {
  const actionRef = useRef(action);
  actionRef.current = action;
  useEffect(() => {
    if (!active) return;
    const t = window.setTimeout(() => actionRef.current(), delayMs);
    return () => window.clearTimeout(t);
  }, [active, delayMs]);
}
