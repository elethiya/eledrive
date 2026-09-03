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
  const [isConnected, setIsConnected] = useState(false);
  const [lastEvent, setLastEvent] = useState(null);
  const subscribersRef = useRef(new Set());
  const eventSourceRef = useRef(null);
  const reconnectTimeoutRef = useRef(null);

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
    setLastEvent(event);

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
    if (!user) {
      if (eventSourceRef.current) {
        eventSourceRef.current.close();
        eventSourceRef.current = null;
      }
      setIsConnected(false);
      return;
    }

    let isUnmounted = false;

    const connectSSE = () => {
      if (eventSourceRef.current) {
        eventSourceRef.current.close();
      }

      const url = `/api/events?user_id=${encodeURIComponent(user.id || '')}`;
      const es = new EventSource(url);
      eventSourceRef.current = es;

      es.onopen = () => {
        if (!isUnmounted) {
          setIsConnected(true);
        }
      };

      es.addEventListener('connected', () => {
        if (!isUnmounted) {
          setIsConnected(true);
        }
      });

      es.addEventListener('message', (e) => {
        try {
          const data = JSON.parse(e.data);
          dispatchEvent(data);
        } catch (err) {
          console.warn('[Realtime] Failed to parse SSE message:', err);
        }
      });

      es.onerror = () => {
        if (!isUnmounted) {
          setIsConnected(false);
          es.close();
          // Attempt reconnection after 3 seconds
          clearTimeout(reconnectTimeoutRef.current);
          reconnectTimeoutRef.current = setTimeout(() => {
            if (!isUnmounted && user) {
              connectSSE();
            }
          }, 3000);
        }
      };
    };

    connectSSE();

    return () => {
      isUnmounted = true;
      clearTimeout(reconnectTimeoutRef.current);
      if (eventSourceRef.current) {
        eventSourceRef.current.close();
        eventSourceRef.current = null;
      }
      setIsConnected(false);
    };
  }, [user, dispatchEvent]);

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
