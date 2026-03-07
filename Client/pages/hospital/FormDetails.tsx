import { API_URL } from '../../config/api';
import React, { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import Card from '../../components/Card';
import { useAuth } from '../../contexts/AuthContext';

interface FormField {
    label: string;
    key: string;
    type: string;
    required?: boolean;
    options?: string[];
}

interface FormTemplate {
    _id: string;
    name: string;
    description?: string;
    fields: FormField[];
    active?: boolean;
    updatedAt?: string;
    createdAt?: string;
}

const typeLabels: Record<string, string> = {
    text: 'Text',
    textarea: 'Long Text',
    number: 'Number',
    date: 'Date',
    select: 'Dropdown',
    file: 'File Upload',
};

const FormDetails: React.FC = () => {
    const { formId } = useParams<{ formId: string }>();
    const { user } = useAuth();
    const navigate = useNavigate();
    const [form, setForm] = useState<FormTemplate | null>(null);
    const [loading, setLoading] = useState(true);
    const [updatingStatus, setUpdatingStatus] = useState(false);

    useEffect(() => {
        const fetchForm = async () => {
            if (!user || !formId) return;
            setLoading(true);
            try {
                const resp = await fetch(`${API_URL}/hospitals/${user.id}/forms/${formId}`);
                const data = await resp.json();
                if (!resp.ok) throw new Error(data.error || 'Failed to fetch form');
                setForm(data.form);
            } catch (err) {
                console.error('fetch form detail', err);
                setForm(null);
            } finally {
                setLoading(false);
            }
        };
        fetchForm();
    }, [user, formId]);

    const toggleStatus = async () => {
        if (!user || !formId || !form) return;
        setUpdatingStatus(true);
        try {
            const resp = await fetch(`${API_URL}/hospitals/${user.id}/forms/${formId}`, {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ active: !form.active }),
            });
            const data = await resp.json();
            if (!resp.ok) throw new Error(data.error || 'Failed to update form status');
            setForm(prev => prev ? { ...prev, active: !prev.active } : prev);
        } catch (err) {
            console.error('toggle form', err);
            alert('Unable to update form status');
        } finally {
            setUpdatingStatus(false);
        }
    };

    if (loading) {
        return <Loader text="Loading form details..." fullScreen />;
    }

    if (!form) {
        return <Card><p>Form not found.</p></Card>;
    }

    return (
        <div className="space-y-6">
            <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
                <div>
                    <h2 className="text-2xl font-bold text-slate-800 dark:text-slate-200">{form.name}</h2>
                    {form.description && <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">{form.description}</p>}
                    <div className="mt-2 flex flex-wrap items-center gap-3 text-xs text-slate-500 dark:text-slate-400">
                        <span>Status: 
                            <span className={`ml-2 px-2 py-1 rounded-full font-medium ${form.active ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-200' : 'bg-rose-100 text-rose-700 dark:bg-rose-900/40 dark:text-rose-200'}`}>
                                {form.active ? 'Active' : 'Inactive'}
                            </span>
                        </span>
                        {form.updatedAt && <span>Last updated {new Date(form.updatedAt).toLocaleString('en-IN', { timeZone: 'Asia/Kolkata', day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit', hour12: true })}</span>}
                        {form.createdAt && <span>Created {new Date(form.createdAt).toLocaleString('en-IN', { timeZone: 'Asia/Kolkata', day: '2-digit', month: 'short', year: 'numeric' })}</span>}
                    </div>
                </div>
                <div className="flex flex-wrap gap-2">
                    <button
                        onClick={() => navigate(`/hospital/forms/${formId}/edit`)}
                        className="px-4 py-2 border border-slate-300 dark:border-slate-600 rounded-lg text-sm text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-700"
                    >
                        Edit Form
                    </button>
                    <button
                        onClick={toggleStatus}
                        disabled={updatingStatus}
                        className={`px-4 py-2 rounded-lg text-sm border ${form.active
                            ? 'text-rose-600 border-rose-200 hover:bg-rose-50 dark:border-rose-800 dark:hover:bg-rose-900/30'
                            : 'text-emerald-600 border-emerald-200 hover:bg-emerald-50 dark:border-emerald-800 dark:hover:bg-emerald-900/30'
                        }`}
                    >
                        {updatingStatus ? 'Updating...' : form.active ? 'Deactivate' : 'Activate'}
                    </button>
                </div>
            </div>

            <Card title="Form Fields">
                {form.fields.length === 0 ? (
                    <p className="text-sm text-slate-500 dark:text-slate-400">No fields configured.</p>
                ) : (
                    <ul className="space-y-4">
                        {form.fields.map(field => (
                            <li key={field.key} className="p-4 border border-slate-200 dark:border-slate-700 rounded-lg bg-slate-50 dark:bg-slate-800/50">
                                <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-2">
                                    <div>
                                        <h4 className="text-sm font-semibold text-slate-800 dark:text-slate-200">{field.label}</h4>
                                        <p className="text-xs text-slate-500 dark:text-slate-400">
                                            {typeLabels[field.type] || field.type}{field.required ? ' • Required' : ''}
                                        </p>
                                    </div>
                                    {field.options && field.options.length > 0 && (
                                        <div className="text-xs text-slate-500 dark:text-slate-400">
                                            <span className="font-medium text-slate-700 dark:text-slate-200 mr-1">Options:</span>
                                            {field.options.join(', ')}
                                        </div>
                                    )}
                                </div>
                            </li>
                        ))}
                    </ul>
                )}
            </Card>
        </div>
    );
};

export default FormDetails;

