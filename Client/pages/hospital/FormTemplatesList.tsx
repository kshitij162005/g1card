import React, { useEffect, useState } from 'react';
import Card from '../../components/Card';
import { useAuth } from '../../contexts/AuthContext';
import { useNavigate } from 'react-router-dom';

interface Template { _id: string; name: string; description?: string; fields?: any[]; active?: boolean; updatedAt?: string; createdAt?: string; }

const FormTemplatesList: React.FC = () => {
    const { user } = useAuth();
    const [templates, setTemplates] = useState<Template[]>([]);
    const [loading, setLoading] = useState(false);
    const navigate = useNavigate();

    useEffect(() => { fetchTemplates(); }, []);

    const fetchTemplates = async () => {
        if (!user) return;
        setLoading(true);
        try {
            const resp = await fetch(`http://localhost:8082/api/hospitals/${user.id}/forms`);
            const d = await resp.json();
            if (!resp.ok) throw new Error(d.error || 'Failed');
            setTemplates(d.templates || []);
        } catch (err) { console.error('fetch templates', err); }
        finally { setLoading(false); }
    };

    const deleteForm = async (templateId: string, templateName: string) => {
        if (!user) return;
        if (!confirm(`Are you sure you want to permanently delete the form "${templateName}"? This action cannot be undone.`)) return;
        try {
            const resp = await fetch(`http://localhost:8082/api/hospitals/${user.id}/forms/${templateId}`, { method: 'DELETE' });
            const d = await resp.json();
            if (!resp.ok) throw new Error(d.error || 'Failed');
            alert('Form template deleted successfully');
            await fetchTemplates();
        } catch (err) {
            console.error('delete form', err);
            alert('Error deleting form template');
        }
    };

    const toggleFormStatus = async (template: Template) => {
        if (!user) return;
        try {
            const nextStatus = !template.active;
            const resp = await fetch(`http://localhost:8082/api/hospitals/${user.id}/forms/${template._id}`, {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ active: nextStatus }),
            });
            const d = await resp.json();
            if (!resp.ok) throw new Error(d.error || 'Failed');
            await fetchTemplates();
        } catch (err) {
            console.error('toggle form status', err);
            alert('Unable to update form status');
        }
    };

    const statusBadge = (active?: boolean) => (
        <span className={`px-2 py-1 text-xs rounded-full font-medium ${active ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-200' : 'bg-rose-100 text-rose-700 dark:bg-rose-900/40 dark:text-rose-200'}`}>
            {active ? 'Active' : 'Inactive'}
        </span>
    );

    return (
        <Card title="Form Templates">
            <div className="space-y-4">
                <div className="flex justify-between items-center">
                    <p className="text-sm text-slate-600 dark:text-slate-400">Create and manage hospital-specific form templates used when adding medical records.</p>
                    <button onClick={() => navigate('/hospital/forms/create')} className="px-5 py-2.5 bg-brand-primary text-white rounded-lg hover:bg-brand-secondary transition-colors shadow-sm hover:shadow-md">+ Create Form</button>
                </div>

                {loading && <p className="text-sm">Loading...</p>}

                {!loading && templates.length === 0 && (
                    <div className="p-6 border rounded-lg text-slate-700 dark:text-slate-300">No form templates found. Create one to enable structured record creation for patients.</div>
                )}

                {!loading && templates.length > 0 && (
                    <div className="overflow-x-auto">
                        <table className="min-w-full">
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
                                    <tr key={t._id} className="hover:bg-slate-50 dark:hover:bg-slate-700/50">
                                        <td className="py-4 px-6">
                                            <div className="flex flex-col">
                                                <span className="font-medium">{t.name}</span>
                                                {t.description && <span className="text-xs text-slate-500 dark:text-slate-400 mt-1">{t.description}</span>}
                                            </div>
                                        </td>
                                        <td className="py-4 px-6">{statusBadge(t.active)}</td>
                                        <td className="py-4 px-6 text-slate-700 dark:text-slate-300">{(t.fields || []).length} fields</td>
                                        <td className="py-4 px-6 space-x-2">
                                            <button onClick={() => navigate(`/hospital/forms/${t._id}`)} className="text-sm px-3 py-1.5 border border-slate-300 dark:border-slate-600 rounded-md text-slate-700 dark:text-slate-200 bg-white dark:bg-slate-800 hover:bg-slate-50 dark:hover:bg-slate-700 transition-colors">View</button>
                                            <button onClick={() => navigate(`/hospital/forms/${t._id}/edit`)} className="text-sm px-3 py-1.5 border border-blue-300 dark:border-blue-700 rounded-md text-blue-600 dark:text-blue-400 bg-blue-50 dark:bg-blue-900/20 hover:bg-blue-100 dark:hover:bg-blue-900/40 transition-colors">Edit</button>
                                            <button onClick={() => navigate(`/hospital/forms/create?clone=${t._id}`)} className="text-sm px-3 py-1.5 border border-purple-300 dark:border-purple-700 rounded-md text-purple-600 dark:text-purple-400 bg-purple-50 dark:bg-purple-900/20 hover:bg-purple-100 dark:hover:bg-purple-900/40 transition-colors">Clone</button>
                                            <button onClick={() => toggleFormStatus(t)} className={`text-sm px-3 py-1.5 border rounded-md transition-colors ${t.active ? 'border-amber-300 dark:border-amber-700 text-amber-600 dark:text-amber-400 bg-amber-50 dark:bg-amber-900/20 hover:bg-amber-100 dark:hover:bg-amber-900/40' : 'border-emerald-300 dark:border-emerald-700 text-emerald-600 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-900/20 hover:bg-emerald-100 dark:hover:bg-emerald-900/40'}`}>
                                                {t.active ? 'Deactivate' : 'Activate'}
                                            </button>
                                            <button onClick={() => deleteForm(t._id, t.name)} className="text-sm px-3 py-1.5 border border-rose-300 dark:border-rose-700 rounded-md text-rose-600 dark:text-rose-400 bg-rose-50 dark:bg-rose-900/20 hover:bg-rose-100 dark:hover:bg-rose-900/40 transition-colors">Delete</button>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                )}
            </div>
        </Card>
    );
};

export default FormTemplatesList;
