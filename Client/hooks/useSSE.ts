import { useEffect, useRef, useState } from 'react';
import { API_URL } from '../config/api';

export interface SSEEvent {
    type: string;
    title: string;
    message: string;
    timestamp: string;
    [key: string]: any;
}

interface UseSSEOptions {
    userId: string | undefined;
    userType: 'Patient' | 'Hospital' | 'Superadmin';
    onEvent?: (event: SSEEvent) => void;
    enabled?: boolean;
}

export function useSSE({ userId, userType, onEvent, enabled = true }: UseSSEOptions) {
    const [connected, setConnected] = useState(false);
    const [lastEvent, setLastEvent] = useState<SSEEvent | null>(null);
    const eventSourceRef = useRef<EventSource | null>(null);
    const reconnectTimeoutRef = useRef<NodeJS.Timeout | null>(null);

    useEffect(() => {
        if (!userId || !enabled) {
            return;
        }

        const connectSSE = () => {
            const url = `${API_URL}/sse/stream/${userId}/${userType}`;

            console.log(`[SSE] Connecting to ${url}`);
            const eventSource = new EventSource(url);

            eventSource.onopen = () => {
                console.log('[SSE] Connection opened');
                setConnected(true);
            };

            eventSource.onmessage = (event) => {
                try {
                    const data: SSEEvent = JSON.parse(event.data);
                    console.log('[SSE] Event received:', data);
                    
                    setLastEvent(data);
                    if (onEvent && data.type !== 'connected') {
                        onEvent(data);
                    }
                } catch (err) {
                    console.error('[SSE] Failed to parse event:', err);
                }
            };

            eventSource.onerror = (error) => {
                console.error('[SSE] Error:', error);
                setConnected(false);
                eventSource.close();

                // Reconnect after 5 seconds
                reconnectTimeoutRef.current = setTimeout(() => {
                    console.log('[SSE] Attempting to reconnect...');
                    connectSSE();
                }, 5000);
            };

            eventSourceRef.current = eventSource;
        };

        connectSSE();

        // Cleanup on unmount
        return () => {
            if (eventSourceRef.current) {
                console.log('[SSE] Disconnecting');
                eventSourceRef.current.close();
                eventSourceRef.current = null;
            }
            if (reconnectTimeoutRef.current) {
                clearTimeout(reconnectTimeoutRef.current);
            }
        };
    }, [userId, userType, enabled]);

    return { connected, lastEvent };
}
