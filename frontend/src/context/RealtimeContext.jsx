import React, { createContext, useContext, useEffect, useState, useRef, useCallback } from 'react';
import { useAuth } from './AuthContext';
import { webhookAPI } from '../api/client';

const RealtimeContext = createContext({
  isConnected: false,
  lastEvent: null,
  subscribe: () => () => {},
  triggerWebhook: async () => {},
});

export function RealtimeProvider({ children }) {
  const { user } = useAuth();
  const userId = user?.id;
  const [isConnected, setIsConnected] = useState(false);
  const [lastEvent, setLastEvent] = useState(null);
  const subscribersRef = useRef(new Set());
  const eventSourceRef = useRef(null);
  const reconnectTimeoutRef = useRef(null);
  const pollIntervalRef = useRef(null);
  const consecutiveFailuresRef = useRef(0);
  const isPollingFallbackRef = useRef(false);
  const lastEventTimestampRef = useRef(0);

  // Subscribe to realtime events matching a prefix or wildcard
  const subscribe = useCallback((filter, callback) => {
    const sub = { filter, callback };
    subscribersRef.current.add(sub);
    return () => {
      subscribersRef.current.delete(sub);
    };
  }, []);

  // Trigger inbound webhook to push real-time updates
  const triggerWebhook = useCallback(async (payload) => {
    try {
      return await webhookAPI.trigger(payload);
    } catch (err) {
      console.warn('[Realtime] Webhook trigger failed:', err);
    }
  }, []);

  const dispatchEvent = useCallback((event) => {
    if (!event) return;
    setLastEvent(event);

    // Update watermark timestamp for polling fallback
    if (event.timestamp && event.timestamp > lastEventTimestampRef.current) {
      lastEventTimestampRef.current = event.timestamp;
    }

    // Dispatch to subscribers
    subscribersRef.current.forEach(({ filter, callback }) => {
      try {
        if (
          !filter ||
          filter === '*' ||
          (Array.isArray(filter) && filter.some((f) => event.type?.startsWith(f) || event.target?.startsWith(f))) ||
          event.type?.startsWith(filter) ||
          event.target?.startsWith(filter)
        ) {
          callback(event);
        }
      } catch (err) {
        console.error('[Realtime] Error in event subscriber:', err);
      }
    });

    // Also dispatch on window for global listeners
    window.dispatchEvent(new CustomEvent('eledrive:realtime', { detail: event }));
  }, []);

  useEffect(() => {
    if (!userId) {
      if (eventSourceRef.current) {
        try {
          eventSourceRef.current.close();
        } catch {}
        eventSourceRef.current = null;
      }
      if (pollIntervalRef.current) {
        clearInterval(pollIntervalRef.current);
        pollIntervalRef.current = null;
      }
      clearTimeout(reconnectTimeoutRef.current);
      setIsConnected(false);
      return;
    }

    let isUnmounted = false;
    let cancelSchedule = false;
    let cleanupPageLoad = null;

    // Explicitly close EventSource before unload/pagehide so Firefox doesn't abort
    // the channel during page navigation/reload and log "connection was interrupted while page was loading"
    const handleBeforeUnload = () => {
      if (eventSourceRef.current) {
        try {
          eventSourceRef.current.close();
        } catch {}
        eventSourceRef.current = null;
      }
    };
    window.addEventListener('beforeunload', handleBeforeUnload);
    window.addEventListener('pagehide', handleBeforeUnload);

    // HTTP polling fallback for environments where SSE is blocked by ad blockers or browser policies
    const pollOnce = async () => {
      if (isUnmounted || !userId) return;
      try {
        const since = lastEventTimestampRef.current || (Date.now() - 5000);
        const res = await fetch(`/api/live-sync/poll?since=${since}&uid=${encodeURIComponent(userId)}`, {
          cache: 'no-store',
          headers: { 'Cache-Control': 'no-cache' },
        });
        if (res.ok) {
          const data = await res.json();
          if (data && data.timestamp) {
            lastEventTimestampRef.current = data.timestamp;
          }
          if (data && Array.isArray(data.events)) {
            data.events.forEach((evt) => dispatchEvent(evt));
          }
          if (!isUnmounted) {
            setIsConnected(true);
          }
        }
      } catch {
        // Silently tolerate intermittent network hiccups
      }
    };

    const startPollingFallback = () => {
      if (isPollingFallbackRef.current) return;
      isPollingFallbackRef.current = true;

      if (eventSourceRef.current) {
        try {
          eventSourceRef.current.close();
        } catch {}
        eventSourceRef.current = null;
      }

      // Run poll immediately
      pollOnce();

      // Poll periodically every 4.5 seconds
      if (pollIntervalRef.current) clearInterval(pollIntervalRef.current);
      pollIntervalRef.current = setInterval(pollOnce, 4500);

      // Re-poll immediately on window focus or tab visibility change
      const handleVisibilityOrFocus = () => {
        if (!document.hidden) {
          pollOnce();
        }
      };

      window.addEventListener('focus', handleVisibilityOrFocus);
      document.addEventListener('visibilitychange', handleVisibilityOrFocus);

      // After 60s, attempt to softly re-test SSE in case restriction was transient
      clearTimeout(reconnectTimeoutRef.current);
      reconnectTimeoutRef.current = setTimeout(() => {
        if (!isUnmounted && userId) {
          isPollingFallbackRef.current = false;
          connectStream();
        }
      }, 60000);
    };

    const connectStream = () => {
      if (isUnmounted || !userId) return;

      if (eventSourceRef.current) {
        try {
          eventSourceRef.current.close();
        } catch {}
        eventSourceRef.current = null;
      }

      // Use adblocker-neutral endpoint name with 'uid' query parameter
      const url = `/api/live-sync?uid=${encodeURIComponent(userId)}`;

      try {
        const es = new EventSource(url);
        eventSourceRef.current = es;

        es.onopen = () => {
          if (!isUnmounted) {
            consecutiveFailuresRef.current = 0;
            isPollingFallbackRef.current = false;
            if (pollIntervalRef.current) {
              clearInterval(pollIntervalRef.current);
              pollIntervalRef.current = null;
            }
            setIsConnected(true);
          }
        };

        es.addEventListener('connected', () => {
          if (!isUnmounted) {
            consecutiveFailuresRef.current = 0;
            isPollingFallbackRef.current = false;
            if (pollIntervalRef.current) {
              clearInterval(pollIntervalRef.current);
              pollIntervalRef.current = null;
            }
            setIsConnected(true);
          }
        });

        es.addEventListener('message', (e) => {
          try {
            const data = JSON.parse(e.data);
            dispatchEvent(data);
          } catch (err) {
            console.warn('[Realtime] Failed to parse stream message:', err);
          }
        });

        es.onerror = () => {
          if (isUnmounted) return;

          // If browser is actively reconnecting in background (readyState === 0 CONNECTING),
          // don't abort it prematurely; let the browser reconnect naturally
          if (es.readyState === EventSource.CONNECTING) {
            setIsConnected(false);
            return;
          }

          try {
            es.close();
          } catch {}
          eventSourceRef.current = null;
          setIsConnected(false);

          consecutiveFailuresRef.current += 1;

          // If SSE fails repeatedly, activate polling fallback seamlessly
          if (consecutiveFailuresRef.current >= 3) {
            startPollingFallback();
          } else {
            clearTimeout(reconnectTimeoutRef.current);
            reconnectTimeoutRef.current = setTimeout(() => {
              if (!isUnmounted && userId) {
                connectStream();
              }
            }, 3000);
          }
        };
      } catch {
        // If EventSource construction was blocked by a browser extension
        startPollingFallback();
      }
    };

    // Defer connecting until page load finishes so Firefox does not associate the persistent stream
    // with the initial page load transaction and log "The connection was interrupted while the page was loading"
    if (typeof document !== 'undefined' && document.readyState !== 'complete') {
      const onWindowLoad = () => {
        if (!cancelSchedule) {
          setTimeout(() => {
            if (!cancelSchedule && !eventSourceRef.current && !isPollingFallbackRef.current) {
              connectStream();
            }
          }, 150);
        }
      };
      window.addEventListener('load', onWindowLoad, { once: true });
      cleanupPageLoad = () => window.removeEventListener('load', onWindowLoad);

      // Generous fallback timer in case load event already completed
      reconnectTimeoutRef.current = setTimeout(() => {
        if (!cancelSchedule && !eventSourceRef.current && !isPollingFallbackRef.current) {
          connectStream();
        }
      }, 3000);
    } else {
      reconnectTimeoutRef.current = setTimeout(() => {
        if (!cancelSchedule && !eventSourceRef.current && !isPollingFallbackRef.current) {
          connectStream();
        }
      }, 150);
    }

    return () => {
      isUnmounted = true;
      cancelSchedule = true;
      window.removeEventListener('beforeunload', handleBeforeUnload);
      window.removeEventListener('pagehide', handleBeforeUnload);
      if (cleanupPageLoad) cleanupPageLoad();
      clearTimeout(reconnectTimeoutRef.current);
      if (pollIntervalRef.current) {
        clearInterval(pollIntervalRef.current);
        pollIntervalRef.current = null;
      }
      if (eventSourceRef.current) {
        try {
          eventSourceRef.current.close();
        } catch {}
        eventSourceRef.current = null;
      }
      setIsConnected(false);
    };
  }, [userId, dispatchEvent]);

  return (
    <RealtimeContext.Provider value={{ isConnected, lastEvent, subscribe, triggerWebhook }}>
      {children}
    </RealtimeContext.Provider>
  );
}

export function useRealtime() {
  return useContext(RealtimeContext);
}

// Hook to subscribe to realtime events in any component
export function useRealtimeEvent(filter, callback) {
  const { subscribe } = useRealtime();

  const savedCallback = useRef(callback);
  useEffect(() => {
    savedCallback.current = callback;
  }, [callback]);

  useEffect(() => {
    const unsubscribe = subscribe(filter, (evt) => {
      if (savedCallback.current) {
        savedCallback.current(evt);
      }
    });
    return unsubscribe;
  }, [filter, subscribe]);
}
