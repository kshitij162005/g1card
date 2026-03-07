import React, { useEffect, useState } from 'react';
import Card from '../../components/Card';
import { API_URL } from '../../config/api';
import { useAuth } from '../../contexts/AuthContext';
import Loader from '../../components/Loader';

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
    const [filter, setFilter] = useState<'all' | 'unread'>('unread');
    const [page, setPage] = useState(1);
    const [pagination, setPagination] = useState({ total: 0, pages: 1, limit: 10 });
    const [totalCount, setTotalCount] = useState(0);
    const [unreadCount, setUnreadCount] = useState(0);
    const [searchTerm, setSearchTerm] = useState('');

    const loadNotifications = async () => {
        if (!user?.id) return;
        setLoading(true);
        try {
            const resp = await fetch(`${API_URL}/hospitals/${user.id}/notifications?page=${page}&limit=10&filter=${filter}&search=${encodeURIComponent(searchTerm)}`);
            const data = await resp.json();
            if (resp.ok && data.notifications) {
                setNotifications(data.notifications);
                if (data.pagination) {
                    setPagination(data.pagination);
                }
                // Track counts separately
                if (data.totalCount !== undefined) setTotalCount(data.totalCount);
                if (data.unreadCount !== undefined) setUnreadCount(data.unreadCount);
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
    }, [user?.id, page, filter, searchTerm]);

    useEffect(() => {
        setPage(1);
    }, [filter, searchTerm]);

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
        if (!user?.id) return;
        const unreadIds = notifications.filter(n => !n.isRead).map(n => n.id);
        if (unreadIds.length === 0) return;
        
        try {
            for (const id of unreadIds) {
                await markAsRead(id);
            }
            loadNotifications(); // Reload to get updated counts
        } catch (err) {
            console.error('mark all as read error', err);
        }
    };

    return (
        <div className="space-y-6">
            {/* Modern Header */}
            <div className="flex items-center justify-between">
                <div>
                    <h1 className="text-2xl font-bold text-slate-900 dark:text-slate-100">Notifications</h1>
                    <p className="text-sm text-slate-600 dark:text-slate-400 mt-1">
                        Stay updated with patient activities and access changes
                    </p>
                </div>
                {unreadCount > 0 && (
                    <button
                        onClick={markAllAsRead}
                        className="px-4 py-2 text-sm font-medium text-blue-600 dark:text-blue-400 hover:text-white hover:bg-blue-600 dark:hover:bg-blue-500 border border-blue-600 dark:border-blue-500 rounded-lg transition-all"
                    >
                        Mark all as read
                    </button>
                )}
            </div>

            <Card>
                <div className="space-y-4">
                    {/* Search Bar */}
                    <div className="flex items-center gap-3">
                        <input
                            type="text"
                            placeholder="Search notifications..."
                            className="flex-1 px-4 py-2 border border-slate-300 dark:border-slate-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100 placeholder:text-slate-400 dark:placeholder:text-slate-500"
                            value={searchTerm}
                            onChange={e => setSearchTerm(e.target.value)}
                        />
                    </div>

                    {/* Modern Filter Tabs */}
                    <div className="flex items-center gap-1 p-1 bg-slate-100 dark:bg-slate-800 rounded-lg w-fit">
                        <button
                            onClick={() => setFilter('unread')}
                            className={`px-4 py-2 text-sm font-medium rounded-md transition-all ${
                                filter === 'unread'
                                    ? 'bg-white dark:bg-slate-700 text-slate-900 dark:text-slate-100 shadow-sm'
                                    : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200'
                            }`}
                        >
                            Unread
                            {unreadCount > 0 && (
                                <span className={`ml-2 px-2 py-0.5 text-xs rounded-full ${
                                    filter === 'unread' 
                                        ? 'bg-blue-100 dark:bg-blue-900 text-blue-700 dark:text-blue-300' 
                                        : 'bg-slate-200 dark:bg-slate-700 text-slate-600 dark:text-slate-400'
                                }`}>
                                    {unreadCount}
                                </span>
                            )}
                        </button>
                        <button
                            onClick={() => setFilter('all')}
                            className={`px-4 py-2 text-sm font-medium rounded-md transition-all ${
                                filter === 'all'
                                    ? 'bg-white dark:bg-slate-700 text-slate-900 dark:text-slate-100 shadow-sm'
                                    : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200'
                            }`}
                        >
                            All
                            <span className={`ml-2 px-2 py-0.5 text-xs rounded-full ${
                                filter === 'all' 
                                    ? 'bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300' 
                                    : 'bg-slate-200 dark:bg-slate-700 text-slate-600 dark:text-slate-400'
                            }`}>
                                {totalCount}
                            </span>
                        </button>
                    </div>

                    {/* Notifications list */}
                    {loading ? (
                        <Loader text="Loading notifications..." size="medium" />
                    ) : notifications.length === 0 ? (
                        <div className="text-center py-12">
                            <svg className="w-16 h-16 mx-auto text-slate-300 dark:text-slate-600 mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" />
                            </svg>
                            <p className="text-slate-500 dark:text-slate-400">
                                {filter === 'unread' ? 'No unread notifications' : 'No notifications yet'}
                            </p>
                        </div>
                    ) : (
                        <div className="space-y-2">
                            {notifications.map((notification) => {
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
                                        className={`group relative p-4 rounded-xl border transition-all hover:shadow-md ${
                                            !notification.isRead 
                                                ? 'bg-blue-50/50 dark:bg-blue-900/10 border-blue-200 dark:border-blue-800' 
                                                : 'bg-white dark:bg-slate-800 border-slate-200 dark:border-slate-700 hover:border-slate-300 dark:hover:border-slate-600'
                                        }`}
                                    >
                                        {/* Unread indicator bar */}
                                        {!notification.isRead && (
                                            <div className="absolute left-0 top-0 bottom-0 w-1 bg-gradient-to-b from-blue-500 to-cyan-500 rounded-l-xl" />
                                        )}
                                        
                                        <div className="flex items-start gap-4">
                                            {/* Icon */}
                                            <div className={`flex-shrink-0 w-10 h-10 rounded-lg flex items-center justify-center ${
                                                !notification.isRead 
                                                    ? 'bg-blue-100 dark:bg-blue-900/30' 
                                                    : 'bg-slate-100 dark:bg-slate-700'
                                            }`}>
                                                <span className={`text-xl ${
                                                    !notification.isRead 
                                                        ? 'text-blue-600 dark:text-blue-400' 
                                                        : config.color
                                                }`}>
                                                    {config.icon}
                                                </span>
                                            </div>
                                            
                                            <div className="flex-1 min-w-0">
                                                {/* Title and badge */}
                                                <div className="flex items-start justify-between gap-2 mb-1.5">
                                                    <h3 className="text-sm font-semibold text-slate-900 dark:text-slate-100">
                                                        {notification.title}
                                                    </h3>
                                                    {!notification.isRead && (
                                                        <span className="flex-shrink-0 px-2 py-0.5 text-xs font-medium bg-blue-500 text-white rounded-full">
                                                            New
                                                        </span>
                                                    )}
                                                </div>
                                                
                                                {/* Message */}
                                                <p className="text-sm text-slate-700 dark:text-slate-300 mb-2 leading-relaxed">
                                                    {notification.message}
                                                </p>
                                                
                                                {/* Meta info */}
                                                <div className="flex items-center gap-3 text-xs text-slate-500 dark:text-slate-400">
                                                    <span className="flex items-center gap-1">
                                                        <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                                                        </svg>
                                                        {senderName}
                                                    </span>
                                                    <span className="flex items-center gap-1">
                                                        <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                                                        </svg>
                                                        {new Date(notification.createdAt).toLocaleString('en-IN', {
                                                            timeZone: 'Asia/Kolkata',
                                                            day: '2-digit',
                                                            month: 'short',
                                                            year: 'numeric',
                                                            hour: '2-digit',
                                                            minute: '2-digit',
                                                            hour12: true
                                                        })}
                                                    </span>
                                                    {!notification.isRead && (
                                                        <button
                                                            onClick={() => markAsRead(notification.id)}
                                                            className="ml-auto text-xs font-medium text-blue-600 dark:text-blue-400 hover:text-blue-700 dark:hover:text-blue-300 hover:underline transition-colors"
                                                        >
                                                            Mark read
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

                    {/* Pagination Controls with Page Numbers */}
                    {!loading && notifications.length > 0 && (
                        <div className="flex items-center justify-between pt-4 mt-4 border-t border-slate-200 dark:border-slate-700">
                            <p className="text-sm text-slate-600 dark:text-slate-400">
                                Showing {(page - 1) * pagination.limit + 1} to {Math.min(page * pagination.limit, pagination.total)} of {pagination.total} results
                            </p>
                            <div className="flex items-center gap-2">
                                <button
                                    disabled={page === 1}
                                    onClick={() => setPage(p => p - 1)}
                                    className="px-3 py-1 border border-slate-300 dark:border-slate-600 rounded-lg text-sm hover:bg-slate-100 dark:hover:bg-slate-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                                >
                                    Previous
                                </button>
                                
                                {/* Page Numbers */}
                                {Array.from({ length: Math.min(pagination.pages, 5) }, (_, i) => {
                                    let pageNum;
                                    if (pagination.pages <= 5) {
                                        pageNum = i + 1;
                                    } else if (page <= 3) {
                                        pageNum = i + 1;
                                    } else if (page >= pagination.pages - 2) {
                                        pageNum = pagination.pages - 4 + i;
                                    } else {
                                        pageNum = page - 2 + i;
                                    }
                                    return (
                                        <button
                                            key={pageNum}
                                            onClick={() => setPage(pageNum)}
                                            className={`px-3 py-1 border rounded-lg text-sm transition-colors ${
                                                page === pageNum
                                                    ? 'bg-blue-500 text-white border-blue-500'
                                                    : 'border-slate-300 dark:border-slate-600 hover:bg-slate-100 dark:hover:bg-slate-700'
                                            }`}
                                        >
                                            {pageNum}
                                        </button>
                                    );
                                })}
                                
                                <button
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

export default HospitalNotifications;
