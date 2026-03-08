import { API_URL } from '../../config/api';

import React, { useEffect, useState } from 'react';
import Card from '../../components/Card';
import { useAuth } from '../../contexts/AuthContext';
import Loader from '../../components/Loader';

interface MedicalRecord {
    _id: string;
    hospital: {
        _id: string;
        name: string;
    };
    form?: {
        _id: string;
        name: string;
        description?: string;
        fields?: any[];
    };
    data: any;
    attachments: any[];
    createdAt: string;
    updatedAt: string;
}

interface HospitalGroup {
    hospitalId: string;
    hospitalName: string;
    recordCount: number;
    lastVisit: string;
}

interface Pagination {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
    hasMore: boolean;
}

interface HospitalRecordsData {
    records: MedicalRecord[];
    pagination: Pagination;
    loading: boolean;
}

const HealthHistory: React.FC = () => {
    const { user } = useAuth();
    const [hospitals, setHospitals] = useState<HospitalGroup[]>([]);
    const [hospitalsPagination, setHospitalsPagination] = useState<Pagination | null>(null);
    const [loadingHospitals, setLoadingHospitals] = useState(true);
    const [loadingMoreHospitals, setLoadingMoreHospitals] = useState(false);
    
    const [hospitalRecords, setHospitalRecords] = useState<Map<string, HospitalRecordsData>>(new Map());
    const [expandedHospitals, setExpandedHospitals] = useState<Set<string>>(new Set());
    const [expandedRecords, setExpandedRecords] = useState<Set<string>>(new Set());

    // Fetch initial hospitals
    useEffect(() => {
        const fetchHospitals = async () => {
            if (!user?.id) return;
            setLoadingHospitals(true);
            try {
                const resp = await fetch(`${API_URL}/patients/${user.id}/records/hospitals?page=1&limit=10`);
                const data = await resp.json();
                if (resp.ok && data?.hospitals) {
                    setHospitals(data.hospitals);
                    setHospitalsPagination(data.pagination);
                    
                    // Auto-expand the most recent hospital
                    if (data.hospitals.length > 0) {
                        const firstHospitalId = data.hospitals[0].hospitalId;
                        setExpandedHospitals(new Set([firstHospitalId]));
                        // Load records for the first hospital
                        loadHospitalRecords(firstHospitalId, 1);
                    }
                }
            } catch (err) {
                console.warn('Could not fetch hospitals', err);
            } finally {
                setLoadingHospitals(false);
            }
        };
        fetchHospitals();
    }, [user?.id]);

    // Load more hospitals
    const loadMoreHospitals = async () => {
        if (!user?.id || !hospitalsPagination?.hasMore || loadingMoreHospitals) return;
        
        setLoadingMoreHospitals(true);
        try {
            const nextPage = hospitalsPagination.page + 1;
            const resp = await fetch(`${API_URL}/patients/${user.id}/records/hospitals?page=${nextPage}&limit=10`);
            const data = await resp.json();
            if (resp.ok && data?.hospitals) {
                setHospitals(prev => [...prev, ...data.hospitals]);
                setHospitalsPagination(data.pagination);
            }
        } catch (err) {
            console.warn('Could not load more hospitals', err);
        } finally {
            setLoadingMoreHospitals(false);
        }
    };

    // Load records for a specific hospital
    const loadHospitalRecords = async (hospitalId: string, page: number) => {
        if (!user?.id) return;
        
        // Update loading state for this hospital
        setHospitalRecords(prev => {
            const newMap = new Map(prev);
            const existing = newMap.get(hospitalId) as HospitalRecordsData | undefined;
            newMap.set(hospitalId, {
                records: existing?.records || [],
                pagination: existing?.pagination || { page: 0, limit: 10, total: 0, totalPages: 0, hasMore: false },
                loading: true
            });
            return newMap;
        });

        try {
            const resp = await fetch(`${API_URL}/patients/${user.id}/records/hospital/${hospitalId}?page=${page}&limit=10`);
            const data = await resp.json();
            if (resp.ok && data?.records) {
                setHospitalRecords(prev => {
                    const newMap = new Map(prev);
                    const existing = newMap.get(hospitalId) as HospitalRecordsData | undefined;
                    newMap.set(hospitalId, {
                        records: page === 1 ? data.records : [...(existing?.records || []), ...data.records],
                        pagination: data.pagination,
                        loading: false
                    });
                    return newMap;
                });
            }
        } catch (err) {
            console.warn('Could not fetch hospital records', err);
            setHospitalRecords(prev => {
                const newMap = new Map(prev);
                const existing = newMap.get(hospitalId) as HospitalRecordsData | undefined;
                if (existing) {
                    newMap.set(hospitalId, { ...existing, loading: false });
                }
                return newMap;
            });
        }
    };

    // Load more records for a hospital
    const loadMoreRecords = (hospitalId: string) => {
        const data = hospitalRecords.get(hospitalId);
        if (data && data.pagination.hasMore && !data.loading) {
            loadHospitalRecords(hospitalId, data.pagination.page + 1);
        }
    };

    const toggleHospital = (hospitalId: string) => {
        setExpandedHospitals(prev => {
            const newSet = new Set(prev);
            if (newSet.has(hospitalId)) {
                newSet.delete(hospitalId);
            } else {
                newSet.add(hospitalId);
                // Load records if not already loaded
                if (!hospitalRecords.has(hospitalId)) {
                    loadHospitalRecords(hospitalId, 1);
                }
            }
            return newSet;
        });
    };

    const toggleRecord = (recordId: string) => {
        setExpandedRecords(prev => {
            const newSet = new Set(prev);
            if (newSet.has(recordId)) {
                newSet.delete(recordId);
            } else {
                newSet.add(recordId);
            }
            return newSet;
        });
    };

    const formatDate = (dateString: string) => {
        const date = new Date(dateString);
        return date.toLocaleString('en-IN', {
            timeZone: 'Asia/Kolkata',
            day: '2-digit',
            month: 'short',
            year: 'numeric',
            hour: '2-digit',
            minute: '2-digit',
            hour12: true
        });
    };

    const formatShortDate = (dateString: string) => {
        const date = new Date(dateString);
        return date.toLocaleDateString('en-IN', {
            timeZone: 'Asia/Kolkata',
            day: '2-digit',
            month: 'short',
            year: 'numeric'
        });
    };

    return (
        <div className="space-y-6">
            <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
                <div>
                    <h2 className="text-2xl font-bold text-slate-900 dark:text-slate-100">Medical Records</h2>
                    <p className="text-sm text-slate-600 dark:text-slate-400 mt-1">
                        {hospitalsPagination ? `${hospitalsPagination.total} hospital${hospitalsPagination.total !== 1 ? 's' : ''}` : 'Loading...'}
                    </p>
                </div>
                <div className="flex items-center gap-2">
                    <button 
                        onClick={() => notify('Preparing a zip file with all your records.')} 
                        className="px-4 py-2 bg-brand-primary text-white rounded-lg hover:bg-brand-secondary text-sm font-medium shadow-sm hover:shadow transition-all"
                    >
                        Download All
                    </button>
                </div>
            </div>

            {loadingHospitals ? (
                <Loader text="Loading your health records..." fullScreen />
            ) : hospitals.length === 0 ? (
                <Card>
                    <div className="p-8 text-center">
                        <svg className="w-16 h-16 text-slate-300 dark:text-slate-600 mx-auto mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                        </svg>
                        <h3 className="text-lg font-semibold text-slate-700 dark:text-slate-300 mb-2">No Medical Records Yet</h3>
                        <p className="text-sm text-slate-500 dark:text-slate-400">Your medical records from hospitals will appear here.</p>
                    </div>
                </Card>
            ) : (
                <div className="space-y-4">
                    {hospitals.map((hospitalGroup) => (
                        <Card key={hospitalGroup.hospitalId}>
                            <button
                                type="button"
                                className="w-full text-left flex items-center justify-between cursor-pointer p-4 hover:bg-slate-50 dark:hover:bg-slate-800/50 rounded-lg transition-colors"
                                onClick={() => toggleHospital(hospitalGroup.hospitalId)}
                                aria-expanded={expandedHospitals.has(hospitalGroup.hospitalId)}
                                aria-label={`Toggle records for ${hospitalGroup.hospitalName}`}
                            >
                                <div className="flex items-center gap-4">
                                    <div className="p-3 bg-blue-100 dark:bg-blue-900/30 rounded-lg">
                                        <svg className="w-6 h-6 text-blue-600 dark:text-blue-400" fill="currentColor" viewBox="0 0 20 20">
                                            <path fillRule="evenodd" d="M4 4a2 2 0 012-2h8a2 2 0 012 2v12a1 1 0 110 2h-3a1 1 0 01-1-1v-2a1 1 0 00-1-1H9a1 1 0 00-1 1v2a1 1 0 01-1 1H4a1 1 0 110-2V4zm3 1h2v2H7V5zm2 4H7v2h2V9zm2-4h2v2h-2V5zm2 4h-2v2h2V9z" clipRule="evenodd" />
                                        </svg>
                                    </div>
                                    <div>
                                        <h3 className="text-lg font-semibold text-slate-900 dark:text-slate-100">{hospitalGroup.hospitalName}</h3>
                                        <div className="flex items-center gap-4 mt-1 text-sm text-slate-600 dark:text-slate-400">
                                            <span className="flex items-center gap-1">
                                                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                                                </svg>
                                                {hospitalGroup.recordCount} record{hospitalGroup.recordCount !== 1 ? 's' : ''}
                                            </span>
                                            <span className="flex items-center gap-1">
                                                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                                                </svg>
                                                Last visit: {formatShortDate(hospitalGroup.lastVisit)}
                                            </span>
                                        </div>
                                    </div>
                                </div>
                                <svg 
                                    className={`w-6 h-6 text-slate-400 transition-transform duration-200 ${expandedHospitals.has(hospitalGroup.hospitalId) ? 'rotate-180' : ''}`} 
                                    fill="none" 
                                    stroke="currentColor" 
                                    viewBox="0 0 24 24"
                                >
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                                </svg>
                            </button>

                            {expandedHospitals.has(hospitalGroup.hospitalId) && (
                                <div className="px-4 pb-4 space-y-3">
                                    <div className="border-t border-slate-200 dark:border-slate-700 my-2"></div>
                                    
                                    {(() => {
                                        const data = hospitalRecords.get(hospitalGroup.hospitalId);
                                        
                                        if (data?.loading && (!data.records || data.records.length === 0)) {
                                            return (
                                                <div className="p-8 text-center">
                                                    <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-brand-primary mx-auto"></div>
                                                    <p className="text-sm text-slate-500 dark:text-slate-400 mt-2">Loading records...</p>
                                                </div>
                                            );
                                        }
                                        
                                        if (!data || !data.records || data.records.length === 0) {
                                            return (
                                                <div className="p-8 text-center">
                                                    <p className="text-sm text-slate-500 dark:text-slate-400">No records found</p>
                                                </div>
                                            );
                                        }
                                        
                                        return (
                                            <>
                                                {data.records.map((record) => (
                                                    <div 
                                                        key={record._id}
                                                        className="border border-slate-200 dark:border-slate-700 rounded-lg overflow-hidden hover:border-brand-primary dark:hover:border-brand-primary transition-colors"
                                                    >
                                                        <button
                                                            type="button"
                                                            className="w-full text-left flex items-center justify-between p-4 cursor-pointer bg-slate-50 dark:bg-slate-800/50 hover:bg-slate-100 dark:hover:bg-slate-800"
                                                            onClick={() => toggleRecord(record._id)}
                                                            aria-expanded={expandedRecords.has(record._id)}
                                                            aria-label={`Toggle record ${record.form?.name || 'Medical Record'}`}
                                                        >
                                                            <div className="flex-1">
                                                                <div className="flex items-center gap-3">
                                                                    <div className="p-2 bg-white dark:bg-slate-900 rounded-lg border border-slate-200 dark:border-slate-700">
                                                                        <svg className="w-5 h-5 text-brand-primary" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                                                                        </svg>
                                                                    </div>
                                                                    <div>
                                                                        <h4 className="font-semibold text-slate-900 dark:text-slate-100">
                                                                            {record.form?.name || 'Medical Record'}
                                                                        </h4>
                                                                        <p className="text-sm text-slate-600 dark:text-slate-400 mt-0.5">
                                                                            {formatDate(record.createdAt)}
                                                                        </p>
                                                                    </div>
                                                                </div>
                                                            </div>
                                                            <svg 
                                                                className={`w-5 h-5 text-slate-400 transition-transform duration-200 ${expandedRecords.has(record._id) ? 'rotate-180' : ''}`} 
                                                                fill="none" 
                                                                stroke="currentColor" 
                                                                viewBox="0 0 24 24"
                                                            >
                                                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                                                            </svg>
                                                        </button>

                                                        {expandedRecords.has(record._id) && (
                                                            <div className="border-t border-slate-200 dark:border-slate-700 p-4 bg-white dark:bg-slate-900">
                                                                {record.form?.description && (
                                                                    <p className="text-sm text-slate-600 dark:text-slate-400 mb-4 pb-4 border-b border-slate-200 dark:border-slate-700">
                                                                        {record.form.description}
                                                                    </p>
                                                                )}
                                                                
                                                                {record.data && Object.keys(record.data).length > 0 ? (
                                                                    <div className="space-y-3">
                                                                        <h5 className="text-sm font-semibold text-slate-700 dark:text-slate-300 uppercase tracking-wide">Record Details</h5>
                                                                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                                                            {Object.entries(record.data).map(([key, value]) => (
                                                                                <div key={key} className="bg-slate-50 dark:bg-slate-800/50 p-3 rounded-lg">
                                                                                    <p className="text-xs font-medium text-slate-500 dark:text-slate-400 uppercase tracking-wide mb-1">
                                                                                        {key.replace(/_/g, ' ')}
                                                                                    </p>
                                                                                    <p className="text-sm text-slate-900 dark:text-slate-100 font-medium">
                                                                                        {String(value) || '—'}
                                                                                    </p>
                                                                                </div>
                                                                            ))}
                                                                        </div>
                                                                    </div>
                                                                ) : (
                                                                    <p className="text-sm text-slate-500 dark:text-slate-400 italic">No additional details available</p>
                                                                )}

                                                                {record.attachments && record.attachments.length > 0 && (
                                                                    <div className="mt-4 pt-4 border-t border-slate-200 dark:border-slate-700">
                                                                        <h5 className="text-sm font-semibold text-slate-700 dark:text-slate-300 uppercase tracking-wide mb-3">Attachments</h5>
                                                                        <div className="space-y-2">
                                                                            {record.attachments.map((attachment: any, idx: number) => (
                                                                                <div key={idx} className="flex items-center justify-between p-2 bg-slate-50 dark:bg-slate-800/50 rounded-lg">
                                                                                    <div className="flex items-center gap-2">
                                                                                        <svg className="w-5 h-5 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.172 7l-6.586 6.586a2 2 0 102.828 2.828l6.414-6.586a4 4 0 00-5.656-5.656l-6.415 6.585a6 6 0 108.486 8.486L20.5 13" />
                                                                                        </svg>
                                                                                        <span className="text-sm text-slate-700 dark:text-slate-300">{attachment.name || `Attachment ${idx + 1}`}</span>
                                                                                    </div>
                                                                                    <button className="text-xs text-brand-accent hover:underline">Download</button>
                                                                                </div>
                                                                            ))}
                                                                        </div>
                                                                    </div>
                                                                )}
                                                            </div>
                                                        )}
                                                    </div>
                                                ))}
                                                
                                                {/* Load More Records Button */}
                                                {data.pagination.hasMore && (
                                                    <div className="pt-3">
                                                        <button
                                                            onClick={(e) => {
                                                                e.stopPropagation();
                                                                loadMoreRecords(hospitalGroup.hospitalId);
                                                            }}
                                                            disabled={data.loading}
                                                            className="w-full py-2 px-4 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 rounded-lg text-sm font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                                                        >
                                                            {data.loading ? (
                                                                <>
                                                                    <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-slate-600"></div>
                                                                    Loading...
                                                                </>
                                                            ) : (
                                                                <>
                                                                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                                                                    </svg>
                                                                    Load More Records ({data.pagination.total - data.records.length} remaining)
                                                                </>
                                                            )}
                                                        </button>
                                                    </div>
                                                )}
                                            </>
                                        );
                                    })()}
                                </div>
                            )}
                        </Card>
                    ))}
                    
                    {/* Load More Hospitals Button */}
                    {hospitalsPagination && hospitalsPagination.hasMore && (
                        <div className="pt-2">
                            <button
                                onClick={loadMoreHospitals}
                                disabled={loadingMoreHospitals}
                                className="w-full py-3 px-4 bg-white dark:bg-slate-800 border-2 border-slate-200 dark:border-slate-700 hover:border-brand-primary dark:hover:border-brand-primary text-slate-700 dark:text-slate-300 rounded-lg font-medium transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2 shadow-sm hover:shadow"
                            >
                                {loadingMoreHospitals ? (
                                    <>
                                        <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-brand-primary"></div>
                                        Loading more hospitals...
                                    </>
                                ) : (
                                    <>
                                        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                                        </svg>
                                        Load More Hospitals ({hospitalsPagination.total - hospitals.length} remaining)
                                    </>
                                )}
                            </button>
                        </div>
                    )}
                </div>
            )}
        </div>
    );
};

export default HealthHistory;