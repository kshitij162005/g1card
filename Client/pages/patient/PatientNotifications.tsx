import React, { useEffect, useState } from 'react';
import Card from '../../components/Card';
import { API_URL } from '../../config/api';
import { useAuth } from '../../contexts/AuthContext';
import Loader from '../../components/Loader';
import { useSSE } from '../../hooks/useSSE';

interface Notification {
    id: string;
    type: string;
    title: string;
    message: string;
    metadata?: any;
    isRead: boolean;
    readAt?: string;
    actionUrl?: string;
    relatedAccess?: string;
    sender?: { _id: string; name: string; firstName?: string; lastName?: string };
    createdAt: string;
    updatedAt: string;
}

const notificationTypeConfig: Record<string, { icon: string; color: string }> = {
    ACCESS_REQUEST: { icon: '!', color: 'text-amber-600 dark:text-amber-400' },
    ACCESS_UPGRADE_REQUEST: { icon: '↟', color: 'text-orange-600 dark:text-orange-400' },
    ACCESS_LEVEL_CHANGED: { icon: '↻', color: 'text-blue-600 dark:text-blue-400' },
    MEDICAL_RECORD_CREATED: { icon: '+', color: 'text-emerald-600 dark:text-emerald-400' },
    RECORDS_ACCESSED: { icon: 'i', color: 'text-sky-600 dark:text-sky-400' },
    GENERAL: { icon: '•', color: 'text-slate-600 dark:text-slate-300' },
};

const PatientNotifications: React.FC = () => {
    const { user } = useAuth();
    const [notifications, setNotifications] = useState<Notification[]>([]);
    const [loading, setLoading] = useState(false);
    const [filter, setFilter] = useState<'all' | 'unread'>('unread');
    const [page, setPage] = useState(1);
    const [pagination, setPagination] = useState({ total: 0, pages: 1, limit: 10 });
    const [totalCount, setTotalCount] = useState(0);
    const [unreadCount, setUnreadCount] = useState(0);
    const [searchTerm, setSearchTerm] = useState('');
    const [choiceByNotification, setChoiceByNotification] = useState<Record<string, 'GENERAL' | 'COMPLETE'>>({});

    const loadNotifications = async () => {
        if (!user?.id) return;
        setLoading(true);
        try {
            const resp = await fetch(`${API_URL}/patients/${user.id}/notifications?page=${page}&limit=10&filter=${filter}&search=${encodeURIComponent(searchTerm)}`);
            const data = await resp.json();
            if (resp.ok && data.notifications) {
                setNotifications(data.notifications);
                if (data.pagination) setPagination(data.pagination);
                if (data.totalCount !== undefined) setTotalCount(data.totalCount);
                if (data.unreadCount !== undefined) setUnreadCount(data.unreadCount);
            }
        } catch (err) {
            console.error('load notifications error', err);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        loadNotifications();
    }, [user?.id, page, filter, searchTerm]);

    useEffect(() => {
        setPage(1);
    }, [filter, searchTerm]);

    useSSE({
        userId: user?.id,
        userType: 'Patient',
        enabled: !!user?.id,
        onEvent: () => {
            loadNotifications();
        },
    });

    const markAsRead = async (notificationId: string) => {
        if (!user?.id) return;
        try {
            const resp = await fetch(`${API_URL}/patients/${user.id}/notifications/${notificationId}/read`, {
                method: 'PATCH',
            });
            if (resp.ok) {
                setNotifications(prev => prev.map(n => n.id === notificationId ? { ...n, isRead: true, readAt: new Date().toISOString() } : n));
                setUnreadCount(prev => Math.max(0, prev - 1));
            }
        } catch (err) {
            console.error('mark as read error', err);
        }
    };

    const markAllAsRead = async () => {
        const unread = notifications.filter(n => !n.isRead).map(n => n.id);
        if (!user?.id || unread.length === 0) return;
        await Promise.all(unread.map(id => fetch(`${API_URL}/patients/${user.id}/notifications/${id}/read`, { method: 'PATCH' })));
        loadNotifications();
    };

    const handleAccessDecision = async (notification: Notification, approve: boolean) => {
        if (!user?.id) return;
        const accessId = notification.relatedAccess || notification.metadata?.accessId;
        if (!accessId) return;

        try {
            const body: any = { decision: approve ? 'APPROVE' : 'DENY' };
            if (approve) {
                body.accessLevel = choiceByNotification[notification.id] || 'GENERAL';
            }
            const resp = await fetch(`${API_URL}/patients/${user.id}/access-requests/${accessId}/decision`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(body),
            });
            const data = await resp.json();
            if (!resp.ok) {
                notify(data?.error || data?.message || 'Failed to update access request');
                return;
            }
            notify(approve ? 'Access request approved' : 'Access request denied');
            loadNotifications();
        } catch (err) {
            console.error('access decision error', err);
            notify('Failed to update access request');
        }
    };

    const handleUpgradeDecision = async (notification: Notification, approve: boolean) => {
        if (!user?.id) return;
        try {
            const resp = await fetch(`${API_URL}/patients/${user.id}/notifications/${notification.id}/upgrade-decision`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ decision: approve ? 'APPROVE' : 'DENY' }),
            });
            const data = await resp.json();
            if (!resp.ok) {
                notify(data?.error || data?.message || 'Failed to process upgrade request');
                return;
            }
            notify(data?.message || 'Upgrade request processed');
            loadNotifications();
        } catch (err) {
            console.error('upgrade decision error', err);
            notify('Failed to process upgrade request');
        }
    };

    const renderActions = (notification: Notification) => {
        if (notification.type === 'ACCESS_REQUEST' && !notification.isRead) {
            return (
                <div className="flex flex-wrap items-center gap-2 mt-3">
                    <select
                        value={choiceByNotification[notification.id] || 'GENERAL'}
                        onChange={(e) => setChoiceByNotification(prev => ({
                            ...prev,
                            [notification.id]: e.target.value === 'COMPLETE' ? 'COMPLETE' : 'GENERAL',
                        }))}
                        className="text-xs border border-slate-300 dark:border-slate-600 rounded-lg px-2 py-1 bg-white dark:bg-slate-900 text-slate-800 dark:text-slate-100"
                    >
                        <option value="GENERAL">General Access</option>
                        <option value="COMPLETE">Complete Access</option>
                    </select>
                    <button
                        type="button"
                        onClick={() => handleAccessDecision(notification, false)}
                        className="px-3 py-1.5 text-xs rounded-lg border border-slate-300 dark:border-slate-600 text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-800"
                    >
                        Deny
                    </button>
                    <button
                        type="button"
                        onClick={() => handleAccessDecision(notification, true)}
                        className="px-3 py-1.5 text-xs rounded-lg bg-blue-600 text-white hover:bg-blue-700"
                    >
                        Approve
                    </button>
                </div>
            );
        }

        if (notification.type === 'ACCESS_UPGRADE_REQUEST' && !notification.isRead) {
            return (
                <div className="flex items-center gap-2 mt-3">
                    <button
                        type="button"
                        onClick={() => handleUpgradeDecision(notification, false)}
                        className="px-3 py-1.5 text-xs rounded-lg border border-slate-300 dark:border-slate-600 text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-800"
                    >
                        Deny
                    </button>
                    <button
                        type="button"
                        onClick={() => handleUpgradeDecision(notification, true)}
                        className="px-3 py-1.5 text-xs rounded-lg bg-orange-600 text-white hover:bg-orange-700"
                    >
                        Grant Complete Access
                    </button>
                </div>
            );
        }

        return null;
    };

    const senderName = (notification: Notification) => {
        if (!notification.sender) return 'System';
        if (notification.sender.firstName || notification.sender.lastName) {
            return `${notification.sender.firstName || ''} ${notification.sender.lastName || ''}`.trim();
        }
        return notification.sender.name || 'System';
    };

    return (
        <div className="space-y-6">
            <div className="flex items-center justify-between">
                <div>
                    <h1 className="text-2xl font-bold text-slate-900 dark:text-slate-100">Notifications</h1>
                    <p className="text-sm text-slate-600 dark:text-slate-400 mt-1">
                        Live updates for access requests, approvals and record activity
                    </p>
                </div>
                {unreadCount > 0 && (
                    <button
                        type="button"
                        onClick={markAllAsRead}
                        className="px-4 py-2 text-sm font-medium text-blue-600 dark:text-blue-400 hover:text-white hover:bg-blue-600 dark:hover:bg-blue-500 border border-blue-600 dark:border-blue-500 rounded-lg transition-all"
                    >
                        Mark all as read
                    </button>
                )}
            </div>

            <Card>
                <div className="space-y-4">
                    <input
                        type="text"
                        placeholder="Search notifications..."
                        className="w-full px-4 py-2 border border-slate-300 dark:border-slate-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100 placeholder:text-slate-400 dark:placeholder:text-slate-500"
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                    />

                    <div className="flex items-center gap-1 p-1 bg-slate-100 dark:bg-slate-800 rounded-lg w-fit">
                        <button
                            type="button"
                            onClick={() => setFilter('unread')}
                            className={`px-4 py-2 text-sm font-medium rounded-md transition-all ${
                                filter === 'unread'
                                    ? 'bg-white dark:bg-slate-700 text-slate-900 dark:text-slate-100 shadow-sm'
                                    : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200'
                            }`}
                        >
                            Unread
                            {unreadCount > 0 && <span className="ml-2 px-2 py-0.5 text-xs rounded-full bg-blue-100 dark:bg-blue-900 text-blue-700 dark:text-blue-300">{unreadCount}</span>}
                        </button>
                        <button
                            type="button"
                            onClick={() => setFilter('all')}
                            className={`px-4 py-2 text-sm font-medium rounded-md transition-all ${
                                filter === 'all'
                                    ? 'bg-white dark:bg-slate-700 text-slate-900 dark:text-slate-100 shadow-sm'
                                    : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200'
                            }`}
                        >
                            All
                            <span className="ml-2 px-2 py-0.5 text-xs rounded-full bg-slate-200 dark:bg-slate-700 text-slate-600 dark:text-slate-300">{totalCount}</span>
                        </button>
                    </div>

                    {loading ? (
                        <Loader text="Loading notifications..." size="medium" />
                    ) : notifications.length === 0 ? (
                        <div className="text-center py-12">
                            <p className="text-slate-500 dark:text-slate-400">{filter === 'unread' ? 'No unread notifications' : 'No notifications yet'}</p>
                        </div>
                    ) : (
                        <div className="space-y-2">
                            {notifications.map((notification) => {
                                const config = notificationTypeConfig[notification.type] || {
                                    icon: 'i',
                                    color: 'text-slate-600 dark:text-slate-300',
                                };

                                return (
                                    <div
                                        key={notification.id}
                                        className={`group relative p-4 rounded-xl border transition-all hover:shadow-md ${
                                            !notification.isRead
                                                ? 'bg-blue-50/50 dark:bg-blue-900/10 border-blue-200 dark:border-blue-800'
                                                : 'bg-white dark:bg-slate-800 border-slate-200 dark:border-slate-700 hover:border-slate-300 dark:hover:border-slate-600'
                                        }`}
                                    >
                                        {!notification.isRead && <div className="absolute left-0 top-0 bottom-0 w-1 bg-gradient-to-b from-blue-500 to-cyan-500 rounded-l-xl" />}

                                        <div className="flex items-start gap-4">
                                            <div className={`flex-shrink-0 w-10 h-10 rounded-lg flex items-center justify-center ${
                                                !notification.isRead ? 'bg-blue-100 dark:bg-blue-900/30' : 'bg-slate-100 dark:bg-slate-700'
                                            }`}>
                                                <span className={`text-lg ${!notification.isRead ? 'text-blue-600 dark:text-blue-400' : config.color}`}>
                                                    {config.icon}
                                                </span>
                                            </div>

                                            <div className="flex-1 min-w-0">
                                                <div className="flex items-start justify-between gap-2 mb-1.5">
                                                    <h3 className="text-sm font-semibold text-slate-900 dark:text-slate-100">{notification.title}</h3>
                                                    {!notification.isRead && (
                                                        <span className="flex-shrink-0 px-2 py-0.5 text-xs font-medium bg-blue-500 text-white rounded-full">New</span>
                                                    )}
                                                </div>

                                                <p className="text-sm text-slate-700 dark:text-slate-300 mb-2 leading-relaxed">{notification.message}</p>

                                                <div className="flex items-center gap-3 text-xs text-slate-500 dark:text-slate-400">
                                                    <span>{senderName(notification)}</span>
                                                    <span>{new Date(notification.createdAt).toLocaleString('en-IN', {
                                                        timeZone: 'Asia/Kolkata',
                                                        day: '2-digit',
                                                        month: 'short',
                                                        year: 'numeric',
                                                        hour: '2-digit',
                                                        minute: '2-digit',
                                                        hour12: true,
                                                    })}</span>
                                                    {!notification.isRead && (
                                                        <button
                                                            type="button"
                                                            onClick={() => markAsRead(notification.id)}
                                                            className="ml-auto text-xs font-medium text-blue-600 dark:text-blue-400 hover:text-blue-700 dark:hover:text-blue-300 hover:underline transition-colors"
                                                        >
                                                            Mark read
                                                        </button>
                                                    )}
                                                </div>

                                                {renderActions(notification)}
                                            </div>
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                    )}

                    {!loading && notifications.length > 0 && (
                        <div className="flex items-center justify-between pt-4 mt-4 border-t border-slate-200 dark:border-slate-700">
                            <p className="text-sm text-slate-600 dark:text-slate-400">
                                Showing {(page - 1) * pagination.limit + 1} to {Math.min(page * pagination.limit, pagination.total)} of {pagination.total} results
                            </p>
                            <div className="flex items-center gap-2">
                                <button
                                    type="button"
                                    disabled={page === 1}
                                    onClick={() => setPage(p => p - 1)}
                                    className="px-3 py-1 border border-slate-300 dark:border-slate-600 rounded-lg text-sm hover:bg-slate-100 dark:hover:bg-slate-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                                >
                                    Previous
                                </button>
                                <button
                                    type="button"
                                    disabled={page >= pagination.pages}
                                    onClick={() => setPage(p => p + 1)}
                                    className="px-3 py-1 border border-slate-300 dark:border-slate-600 rounded-lg text-sm hover:bg-slate-100 dark:hover:bg-slate-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                                >
                                    Next
                                </button>
                            </div>
                        </div>
                    )}
                </div>
            </Card>
        </div>
    );
};

export default PatientNotifications;

