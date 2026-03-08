import React, { useEffect, useState } from 'react';
import GlassNotification from './GlassNotification';
import { APP_NOTIFICATION_EVENT, AppNotificationPayload } from '../utils/notifications';

const AppNotificationCenter: React.FC = () => {
    const [notification, setNotification] = useState<(AppNotificationPayload & { id: number }) | null>(null);

    useEffect(() => {
        const handleNotification = (event: Event) => {
            const customEvent = event as CustomEvent<AppNotificationPayload>;
            const payload = customEvent.detail;

            if (!payload?.message) {
                return;
            }

            setNotification({
                ...payload,
                type: payload.type || 'info',
                id: Date.now()
            });
        };

        window.addEventListener(APP_NOTIFICATION_EVENT, handleNotification);

        return () => {
            window.removeEventListener(APP_NOTIFICATION_EVENT, handleNotification);
        };
    }, []);

    if (!notification) {
        return null;
    }

    return (
        <GlassNotification
            key={notification.id}
            title={notification.title}
            message={notification.message}
            type={notification.type}
            autoClose={notification.autoClose}
            onClose={() => setNotification(null)}
        />
    );
};

export default AppNotificationCenter;
