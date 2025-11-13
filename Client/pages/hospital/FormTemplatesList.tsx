import React, { useEffect, useState } from 'react';
import Card from '../../components/Card';
import { useAuth } from '../../contexts/AuthContext';
import { useNavigate } from 'react-router-dom';

interface Template { _id: string; name: string; description?: string; fields?: any[] }

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

    return (
        <Card title="Form Templates">
            <div className="space-y-4">
                <div className="flex justify-between items-center">
                    <p className="text-sm text-slate-600 dark:text-slate-400">Create and manage hospital-specific form templates used when adding medical records.</p>
                    <div className="flex gap-2">
                        <button onClick={() => navigate('/hospital/forms/create')} className="px-4 py-2 bg-brand-primary text-white rounded-lg">+ Create Form</button>
                        <button onClick={fetchTemplates} className="px-4 py-2 border rounded-lg">Refresh</button>
                    </div>
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
                                    <th className="py-3 px-6 text-left text-xs font-medium text-slate-500 dark:text-slate-300 uppercase">Fields</th>
                                    <th className="py-3 px-6 text-left text-xs font-medium text-slate-500 dark:text-slate-300 uppercase">Actions</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-200 dark:divide-slate-700">
                                {templates.map(t => (
                                    <tr key={t._id} className="hover:bg-slate-50 dark:hover:bg-slate-700/50">
                                        <td className="py-4 px-6">{t.name}</td>
                                        <td className="py-4 px-6">{(t.fields || []).length} fields</td>
                                        <td className="py-4 px-6 space-x-2">
                                            <button onClick={() => navigate(`/hospital/forms/${t._id}`)} className="text-sm px-3 py-1 border rounded">View</button>
                                            <button onClick={() => navigate(`/hospital/forms/create?clone=${t._id}`)} className="text-sm px-3 py-1 border rounded">Clone</button>
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
