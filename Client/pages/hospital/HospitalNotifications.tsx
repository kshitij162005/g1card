import React, { useEffect, useState } from 'react';
import Card from '../../components/Card';
import { API_URL } from '../../config/api';
import { useAuth } from '../../contexts/AuthContext';

interface Notification {
    id: string;
    type: string;
    title: string;
    message: string;
    metadata?: any;
    isRead: boolean;
    readAt?: string;
    sender?: { _id: string; name: string; firstName?: string; lastName?: string };
    createdAt: string;
    updatedAt: string;
}

const notificationTypeConfig: Record<string, { icon: string; color: string; bgColor: string }> = {
    ACCESS_GRANTED: {
        icon: '✓',
        color: 'text-green-700 dark:text-green-400',
        bgColor: 'bg-green-50 dark:bg-green-900/20 border-green-300 dark:border-green-700'
    },
    ACCESS_DENIED: {
        icon: '✕',
        color: 'text-red-700 dark:text-red-400',
        bgColor: 'bg-red-50 dark:bg-red-900/20 border-red-300 dark:border-red-700'
    },
    ACCESS_REVOKED: {
        icon: '⊘',
        color: 'text-orange-700 dark:text-orange-400',
        bgColor: 'bg-orange-50 dark:bg-orange-900/20 border-orange-300 dark:border-orange-700'
    },
    ACCESS_LEVEL_CHANGED: {
        icon: '↻',
        color: 'text-blue-700 dark:text-blue-400',
        bgColor: 'bg-blue-50 dark:bg-blue-900/20 border-blue-300 dark:border-blue-700'
    }
};

const HospitalNotifications: React.FC = () => {
    const { user } = useAuth();
    const [notifications, setNotifications] = useState<Notification[]>([]);
    const [loading, setLoading] = useState(false);
    const [filter, setFilter] = useState<'all' | 'unread'>('all');

    const loadNotifications = async () => {
        if (!user?.id) return;
        setLoading(true);
        try {
            const resp = await fetch(`${API_URL}/hospitals/${user.id}/notifications`);
            const data = await resp.json();
            if (resp.ok && data.notifications) {
                setNotifications(data.notifications);
            } else {
                console.error('Failed to load notifications:', data);
            }
        } catch (err) {
            console.error('load notifications error', err);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        loadNotifications();
    }, [user?.id]);

    const markAsRead = async (notificationId: string) => {
        if (!user?.id) return;
        try {
            const resp = await fetch(`${API_URL}/hospitals/${user.id}/notifications/${notificationId}/read`, {
                method: 'PATCH'
            });
            const data = await resp.json();
            if (resp.ok) {
                // Update local state
                setNotifications(prev => prev.map(n => 
                    n.id === notificationId ? { ...n, isRead: true, readAt: new Date().toISOString() } : n
                ));
            } else {
                console.error('Failed to mark as read:', data);
            }
        } catch (err) {
            console.error('mark as read error', err);
        }
    };

    const markAllAsRead = async () => {
        const unreadIds = notifications.filter(n => !n.isRead).map(n => n.id);
        for (const id of unreadIds) {
            await markAsRead(id);
        }
    };

    const filteredNotifications = filter === 'unread' 
        ? notifications.filter(n => !n.isRead)
        : notifications;

    const unreadCount = notifications.filter(n => !n.isRead).length;

    return (
        <div className="space-y-6">
            <Card title="Notifications">
                <div className="space-y-4">
                    {/* Header with filters and actions */}
                    <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 pb-4 border-b border-slate-200 dark:border-slate-700">
                        <div className="flex items-center gap-2">
                            <button
                                onClick={() => setFilter('all')}
                                className={`px-3 py-1.5 text-sm rounded-lg transition-colors ${
                                    filter === 'all'
                                        ? 'bg-blue-600 text-white'
                                        : 'bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700'
                                }`}
                            >
                                All ({notifications.length})
                            </button>
                            <button
                                onClick={() => setFilter('unread')}
                                className={`px-3 py-1.5 text-sm rounded-lg transition-colors ${
                                    filter === 'unread'
                                        ? 'bg-blue-600 text-white'
                                        : 'bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700'
                                }`}
                            >
                                Unread ({unreadCount})
                            </button>
                        </div>
                        {unreadCount > 0 && (
                            <button
                                onClick={markAllAsRead}
                                className="px-3 py-1.5 text-sm text-blue-600 dark:text-blue-400 hover:text-blue-700 dark:hover:text-blue-300 font-medium"
                            >
                                Mark all as read
                            </button>
                        )}
                    </div>

                    {/* Notifications list */}
                    {loading ? (
                        <p className="text-sm text-slate-500 dark:text-slate-400 text-center py-8">Loading notifications...</p>
                    ) : filteredNotifications.length === 0 ? (
                        <div className="text-center py-12">
                            <svg className="w-16 h-16 mx-auto text-slate-300 dark:text-slate-600 mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" />
                            </svg>
                            <p className="text-slate-500 dark:text-slate-400">
                                {filter === 'unread' ? 'No unread notifications' : 'No notifications yet'}
                            </p>
                        </div>
                    ) : (
                        <div className="space-y-3">
                            {filteredNotifications.map((notification) => {
                                const config = notificationTypeConfig[notification.type] || {
                                    icon: 'ℹ',
                                    color: 'text-slate-700 dark:text-slate-400',
                                    bgColor: 'bg-slate-50 dark:bg-slate-900/20 border-slate-300 dark:border-slate-700'
                                };

                                const senderName = notification.sender 
                                    ? (notification.sender.firstName && notification.sender.lastName 
                                        ? `${notification.sender.firstName} ${notification.sender.lastName}`
                                        : notification.sender.name || 'Unknown')
                                    : 'System';

                                return (
                                    <div
                                        key={notification.id}
                                        className={`p-4 border-2 rounded-lg transition-all ${config.bgColor} ${
                                            !notification.isRead ? 'border-l-4' : ''
                                        }`}
                                    >
                                        <div className="flex items-start gap-3">
                                            <div className={`w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0 ${config.bgColor}`}>
                                                <span className={`text-lg ${config.color}`}>{config.icon}</span>
                                            </div>
                                            <div className="flex-1 min-w-0">
                                                <div className="flex items-start justify-between gap-2 mb-1">
                                                    <h3 className={`text-sm font-semibold ${config.color}`}>
                                                        {notification.title}
                                                    </h3>
                                                    {!notification.isRead && (
                                                        <span className="w-2 h-2 rounded-full bg-blue-600 flex-shrink-0 mt-1" />
                                                    )}
                                                </div>
                                                <p className="text-sm text-slate-700 dark:text-slate-300 mb-2">
                                                    {notification.message}
                                                </p>
                                                <p className="text-xs text-slate-600 dark:text-slate-400 mb-2">
                                                    Patient: {senderName}
                                                </p>
                                                <div className="flex items-center justify-between gap-2">
                                                    <p className="text-xs text-slate-500 dark:text-slate-500">
                                                        {new Date(notification.createdAt).toLocaleString('en-IN', {
                                                            timeZone: 'Asia/Kolkata',
                                                            day: '2-digit',
                                                            month: 'short',
                                                            year: 'numeric',
                                                            hour: '2-digit',
                                                            minute: '2-digit',
                                                            hour12: true
                                                        })}
                                                    </p>
                                                    {!notification.isRead && (
                                                        <button
                                                            onClick={() => markAsRead(notification.id)}
                                                            className="text-xs text-blue-600 dark:text-blue-400 hover:text-blue-700 dark:hover:text-blue-300 font-medium"
                                                        >
                                                            Mark as read
                                                        </button>
                                                    )}
                                                </div>
                                            </div>
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                    )}
                </div>
            </Card>
        </div>
    );
};

export default HospitalNotifications;
