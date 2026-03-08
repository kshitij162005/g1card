export type AppNotificationType = 'info' | 'success' | 'warning' | 'error';

export interface AppNotificationPayload {
    title: string;
    message: string;
    type?: AppNotificationType;
    autoClose?: number;
}

const APP_NOTIFICATION_EVENT = 'g1card:notify';

interface WindowWithAlertBridge extends Window {
    __g1cardAlertBridgeInstalled?: boolean;
    __g1cardOriginalAlert?: typeof window.alert;
    notify?: (message?: unknown) => void;
}

export const pushAppNotification = (payload: AppNotificationPayload) => {
    window.dispatchEvent(new CustomEvent(APP_NOTIFICATION_EVENT, { detail: payload }));
};

const inferTypeFromMessage = (message: string): AppNotificationType => {
    const lower = message.toLowerCase();

    if (lower.includes('error') || lower.includes('failed') || lower.includes('unable')) {
        return 'error';
    }

    if (lower.includes('success') || lower.includes('approved') || lower.includes('updated')) {
        return 'success';
    }

    if (lower.includes('warning') || lower.includes('denied') || lower.includes('rejected')) {
        return 'warning';
    }

    return 'info';
};

export const notify = (message?: unknown) => {
    const text = typeof message === 'string' ? message : String(message ?? '');

    pushAppNotification({
        title: 'Notice',
        message: text,
        type: inferTypeFromMessage(text)
    });
};

export const installAlertNotificationBridge = () => {
    const windowRef = window as WindowWithAlertBridge;

    if (windowRef.__g1cardAlertBridgeInstalled) {
        return;
    }

    windowRef.__g1cardOriginalAlert = window.alert.bind(window);
    windowRef.__g1cardAlertBridgeInstalled = true;
    windowRef.notify = notify;
    (globalThis as { notify?: (message?: unknown) => void }).notify = notify;

    window.alert = notify;
};

export { APP_NOTIFICATION_EVENT };
