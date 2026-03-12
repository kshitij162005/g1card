import { API_URL } from '../../config/api';
import React, { useEffect, useState } from 'react';
import Card from '../../components/Card';
import { useAuth } from '../../contexts/AuthContext';
import { useNavigate } from 'react-router-dom';
import Loader from '../../components/Loader';

interface Template { _id: string; name: string; description?: string; fields?: any[]; active?: boolean; hasBeenPublished?: boolean; updatedAt?: string; createdAt?: string; }

const FormTemplatesList: React.FC = () => {
    const { user } = useAuth();
    const [templates, setTemplates] = useState<Template[]>([]);
    const [loading, setLoading] = useState(true);
    const [loadError, setLoadError] = useState<string>('');
    const [page, setPage] = useState(1);
    const [pagination, setPagination] = useState({ total: 0, pages: 1, limit: 10 });
    const navigate = useNavigate();

    useEffect(() => {
        if (!user?.id) return;
        fetchTemplates();
    }, [page, user?.id]);

    const fetchTemplates = async (attempt = 0) => {
        if (!user?.id) return;
        setLoading(true);
        setLoadError('');
        try {
            const resp = await fetch(`${API_URL}/hospitals/${user.id}/forms?page=${page}&limit=10`);
            const d = await resp.json();
            if (!resp.ok) throw new Error(d.error || 'Failed');
            setTemplates(d.templates || []);
            if (d.pagination) {
                setPagination(d.pagination);
            }
        } catch (err) {
            console.error('fetch templates', err);
            if (attempt < 1) {
                // One quick retry avoids false empty-state flashes during transient startup races.
                return fetchTemplates(attempt + 1);
            }
            setLoadError((err as Error)?.message || 'Unable to load templates');
        }
        finally { setLoading(false); }
    };

    const deleteForm = async (templateId: string, templateName: string) => {
        if (!user) return;
        if (!confirm(`Are you sure you want to permanently delete the form "${templateName}"? This action cannot be undone.`)) return;
        try {
            const resp = await fetch(`${API_URL}/hospitals/${user.id}/forms/${templateId}`, { method: 'DELETE' });
            const d = await resp.json();
            if (!resp.ok) throw new Error(d.error || 'Failed');
            notify('Form template deleted successfully');
            await fetchTemplates();
        } catch (err) {
            console.error('delete form', err);
            notify('Error deleting form template');
        }
    };

    const toggleFormStatus = async (template: Template) => {
        if (!user) return;
        if (template.active === false) {
            notify("Can't be activated as it is in draft and yet to be published");
            navigate(`/hospital/forms/${template._id}/edit`);
            return;
        }
        try {
            const nextStatus = !template.active;
            const resp = await fetch(`${API_URL}/hospitals/${user.id}/forms/${template._id}`, {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ active: nextStatus }),
            });
            const d = await resp.json();
            if (!resp.ok) throw new Error(d.error || 'Failed');
            await fetchTemplates();
        } catch (err) {
            console.error('toggle form status', err);
            notify((err as Error)?.message || 'Unable to update form status');
        }
    };

    const statusBadge = (active?: boolean) => (
        <span className={`px-2.5 py-1 text-xs rounded-full font-medium ${active ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-200' : 'bg-rose-100 text-rose-700 dark:bg-rose-900/40 dark:text-rose-200'}`}>
            {active ? 'Active' : 'Inactive'}
        </span>
    );

    const draftBadge = (template: Template) => {
        if (template.active) return null;
        return (
            <span className="ml-2 px-2 py-0.5 text-[11px] rounded-full font-medium bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-200">
                Draft
            </span>
        );
    };

    const actionButtonBase = 'inline-flex items-center justify-center whitespace-nowrap text-xs font-medium px-3 py-1.5 rounded-lg border transition-colors';

    if (loading && templates.length === 0) {
        return <Loader text="Loading form templates..." fullScreen />;
    }

    return (
        <Card title="Form Templates">
            <div className="space-y-4">
                <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                    <p className="text-sm text-slate-600 dark:text-slate-400 max-w-2xl">Create and manage hospital-specific form templates used when adding medical records.</p>
                    <button onClick={() => navigate('/hospital/forms/create')} className="w-full sm:w-auto px-5 py-2.5 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors shadow-sm">
                        + Create Form
                    </button>
                </div>

                {loading && <p className="text-sm">Loading...</p>}

                {!loading && loadError && (
                    <div className="p-6 border rounded-lg text-slate-700 dark:text-slate-300 flex items-center justify-between gap-3">
                        <span>{loadError}</span>
                        <button onClick={() => fetchTemplates()} className="px-3 py-1.5 rounded-lg border border-slate-300 dark:border-slate-600 text-sm hover:bg-slate-100 dark:hover:bg-slate-700 transition-colors">
                            Retry
                        </button>
                    </div>
                )}

                {!loading && !loadError && templates.length === 0 && (
                    <div className="p-6 border rounded-lg text-slate-700 dark:text-slate-300">No form templates found. Create one to enable structured record creation for patients.</div>
                )}

                {!loading && !loadError && templates.length > 0 && (
                    <div className="overflow-x-auto">
                        <table className="min-w-[980px] w-full">
                            <thead className="bg-slate-50 dark:bg-slate-700">
                                <tr>
                                    <th className="py-3 px-6 text-left text-xs font-medium text-slate-500 dark:text-slate-300 uppercase">Name</th>
                                    <th className="py-3 px-6 text-left text-xs font-medium text-slate-500 dark:text-slate-300 uppercase">Status</th>
                                    <th className="py-3 px-6 text-left text-xs font-medium text-slate-500 dark:text-slate-300 uppercase">Fields</th>
                                    <th className="py-3 px-6 text-left text-xs font-medium text-slate-500 dark:text-slate-300 uppercase">Actions</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-200 dark:divide-slate-700">
                                {templates.map(t => (
                                    <tr
                                        key={t._id}
                                        className="hover:bg-slate-50 dark:hover:bg-slate-700/50 cursor-pointer"
                                        onClick={() => navigate(`/hospital/forms/${t._id}`)}
                                    >
                                        <td className="py-4 px-6">
                                            <div className="flex flex-col">
                                                <span className="font-medium inline-flex items-center">
                                                    {t.name}
                                                    {draftBadge(t)}
                                                </span>
                                                {t.description && <span className="text-xs text-slate-500 dark:text-slate-400 mt-1">{t.description}</span>}
                                            </div>
                                        </td>
                                        <td className="py-4 px-6">{statusBadge(t.active)}</td>
                                        <td className="py-4 px-6 text-slate-700 dark:text-slate-300">{(t.fields || []).length} fields</td>
                                        <td className="py-4 px-6">
                                            <div className="flex items-center gap-2 whitespace-nowrap">
                                                <button
                                                    onClick={(e) => { e.stopPropagation(); navigate(`/hospital/forms/${t._id}`); }}
                                                    className={`${actionButtonBase} border-slate-300 dark:border-slate-600 text-slate-700 dark:text-slate-200 bg-white dark:bg-slate-800 hover:bg-slate-50 dark:hover:bg-slate-700`}
                                                >
                                                    View
                                                </button>
                                                <button
                                                    onClick={(e) => { e.stopPropagation(); navigate(`/hospital/forms/${t._id}/edit`); }}
                                                    className={`${actionButtonBase} border-blue-300 dark:border-blue-700 text-blue-700 dark:text-blue-300 bg-blue-50 dark:bg-blue-900/20 hover:bg-blue-100 dark:hover:bg-blue-900/40`}
                                                >
                                                    Edit
                                                </button>
                                                <button
                                                    onClick={(e) => { e.stopPropagation(); navigate(`/hospital/forms/create?clone=${t._id}`); }}
                                                    className={`${actionButtonBase} border-violet-300 dark:border-violet-700 text-violet-700 dark:text-violet-300 bg-violet-50 dark:bg-violet-900/20 hover:bg-violet-100 dark:hover:bg-violet-900/40`}
                                                >
                                                    Clone
                                                </button>
                                                <button
                                                    onClick={(e) => { e.stopPropagation(); toggleFormStatus(t); }}
                                                    className={`${actionButtonBase} ${t.active ? 'border-amber-300 dark:border-amber-700 text-amber-700 dark:text-amber-300 bg-amber-50 dark:bg-amber-900/20 hover:bg-amber-100 dark:hover:bg-amber-900/40' : 'border-emerald-300 dark:border-emerald-700 text-emerald-700 dark:text-emerald-300 bg-emerald-50 dark:bg-emerald-900/20 hover:bg-emerald-100 dark:hover:bg-emerald-900/40'}`}
                                                >
                                                    {t.active ? 'Deactivate' : 'Activate'}
                                                </button>
                                                <button
                                                    onClick={(e) => { e.stopPropagation(); deleteForm(t._id, t.name); }}
                                                    className={`${actionButtonBase} border-rose-300 dark:border-rose-700 text-rose-700 dark:text-rose-300 bg-rose-50 dark:bg-rose-900/20 hover:bg-rose-100 dark:hover:bg-rose-900/40`}
                                                >
                                                    Delete
                                                </button>
                                            </div>
                                        </td>
                                    </tr>
                                ))}  
                            </tbody>
                        </table>

                        {/* Pagination Controls with Page Numbers */}
                        {pagination.pages > 1 && (
                            <div className="flex items-center justify-between pt-4 mt-4 border-t border-slate-200 dark:border-slate-700">
                                <p className="text-sm text-slate-600 dark:text-slate-400">
                                    Showing {((page - 1) * pagination.limit) + 1} to {Math.min(page * pagination.limit, pagination.total)} of {pagination.total} templates
                                </p>
                                <div className="flex items-center gap-2">
                                    <button
                                        disabled={page === 1}
                                        onClick={() => setPage(p => p - 1)}
                                        className="px-3 py-1 border dark:border-slate-600 rounded-lg text-sm hover:bg-slate-100 dark:hover:bg-slate-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
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
                                        disabled={page === pagination.pages}
                                        onClick={() => setPage(p => p + 1)}
                                        className="px-3 py-1 border dark:border-slate-600 rounded-lg text-sm hover:bg-slate-100 dark:hover:bg-slate-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                                    >
                                        Next
                                    </button>
                                </div>
                            </div>
                        )}
                    </div>
                )}
            </div>
        </Card>
    );
};

export default FormTemplatesList;
