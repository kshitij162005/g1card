import { API_URL } from '../../config/api';
import React, { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import Card from '../../components/Card';
import Loader from '../../components/Loader';
import { useAuth } from '../../contexts/AuthContext';

interface FormField {
    label: string;
    key: string;
    type: string;
    required?: boolean;
    options?: string[];
    description?: string;
    placeholder?: string;
    allowMultiple?: boolean;
    validation?: {
        min?: string;
        max?: string;
        minLength?: number;
        maxLength?: number;
        pattern?: string;
        customError?: string;
    };
}

interface FormTemplate {
    _id: string;
    name: string;
    description?: string;
    fields: FormField[];
    active?: boolean;
    hasBeenPublished?: boolean;
    updatedAt?: string;
    createdAt?: string;
}

const typeLabels: Record<string, string> = {
    text: 'Short Text',
    textarea: 'Long Text',
    number: 'Number',
    date: 'Date',
    time: 'Time',
    select: 'Dropdown',
    radio: 'Single Choice (Radio)',
    checkbox: 'Multiple Choice (Checkbox)',
    email: 'Email',
    tel: 'Phone',
    section: 'Section Break',
    pageBreak: 'Page Break',
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
            notify((err as Error)?.message || 'Unable to update form status');
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

    const statusClass = form.active
        ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-200'
        : 'bg-rose-100 text-rose-700 dark:bg-rose-900/40 dark:text-rose-200';

    return (
        <div className="space-y-6">
            <section className="rounded-2xl border border-slate-200 dark:border-slate-700 bg-white/80 dark:bg-slate-800/70 p-6">
                <div className="flex flex-col lg:flex-row lg:items-start lg:justify-between gap-5">
                    <div className="space-y-3">
                        <h2 className="text-[28px] font-bold text-slate-800 dark:text-slate-100">{form.name}</h2>
                        {form.description && <p className="text-[15px] text-slate-600 dark:text-slate-300">{form.description}</p>}
                        <div className="flex flex-wrap items-center gap-2 text-xs">
                            <span className={`px-2.5 py-1 rounded-full font-medium ${statusClass}`}>
                                {form.active ? 'Active' : 'Inactive'}
                            </span>
                            {!form.active && form.hasBeenPublished !== true && (
                                <span className="px-2.5 py-1 rounded-full font-medium bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-200">
                                    Draft
                                </span>
                            )}
                            {form.updatedAt && (
                                <span className="px-2.5 py-1 rounded-full bg-slate-100 text-slate-600 dark:bg-slate-700 dark:text-slate-300">
                                    Updated {new Date(form.updatedAt).toLocaleString('en-IN', { timeZone: 'Asia/Kolkata', day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit', hour12: true })}
                                </span>
                            )}
                            {form.createdAt && (
                                <span className="px-2.5 py-1 rounded-full bg-slate-100 text-slate-600 dark:bg-slate-700 dark:text-slate-300">
                                    Created {new Date(form.createdAt).toLocaleString('en-IN', { timeZone: 'Asia/Kolkata', day: '2-digit', month: 'short', year: 'numeric' })}
                                </span>
                            )}
                        </div>
                    </div>

                    <div className="flex flex-wrap gap-2">
                        <button
                            onClick={() => navigate('/hospital/forms')}
                            className="px-4 py-2 border border-slate-300 dark:border-slate-600 rounded-lg text-sm text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-700"
                        >
                            Back to Forms
                        </button>
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
            </section>

            <Card title="Form Fields">
                {form.fields.length === 0 ? (
                    <p className="text-sm text-slate-500 dark:text-slate-400">No fields configured.</p>
                ) : (
                    <ul className="space-y-4">
                        {form.fields.map((field, index) => (
                            <li key={field.key} className="p-5 border border-slate-200 dark:border-slate-700 rounded-xl bg-slate-50 dark:bg-slate-800/50">
                                <div className="flex items-start justify-between gap-3">
                                    <div>
                                        <p className="text-xs text-slate-500 dark:text-slate-400 mb-1">Field {index + 1}</p>
                                        <h4 className="text-[18px] font-semibold text-slate-800 dark:text-slate-100">{field.label}</h4>
                                    </div>
                                    <div className="flex flex-wrap items-center gap-2 text-xs">
                                        <span className="px-2 py-1 rounded-full bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-200">
                                            {typeLabels[field.type] || field.type}
                                        </span>
                                        {field.required && (
                                            <span className="px-2 py-1 rounded-full bg-rose-100 text-rose-700 dark:bg-rose-900/30 dark:text-rose-200">
                                                Required
                                            </span>
                                        )}
                                        {field.allowMultiple && (
                                            <span className="px-2 py-1 rounded-full bg-indigo-100 text-indigo-700 dark:bg-indigo-900/30 dark:text-indigo-200">
                                                Multiple
                                            </span>
                                        )}
                                    </div>
                                </div>

                                {field.description && (
                                    <p className="mt-2 text-[15px] text-slate-600 dark:text-slate-300">{field.description}</p>
                                )}

                                {(field.placeholder || (field.options && field.options.length > 0)) && (
                                    <div className="mt-3 space-y-2">
                                        {field.placeholder && (
                                            <p className="text-sm text-slate-500 dark:text-slate-400">Placeholder: {field.placeholder}</p>
                                        )}
                                        {field.options && field.options.length > 0 && (
                                            <div className="flex flex-wrap gap-2">
                                                {field.options.map(option => (
                                                    <span key={option} className="px-2 py-1 rounded-md text-xs bg-slate-200 text-slate-700 dark:bg-slate-700 dark:text-slate-200">
                                                        {option}
                                                    </span>
                                                ))}
                                            </div>
                                        )}
                                    </div>
                                )}

                                {field.validation && (
                                    <div className="mt-3 text-sm text-slate-500 dark:text-slate-400">
                                        <span className="font-medium text-slate-700 dark:text-slate-200 mr-2">Validation:</span>
                                        {[
                                            field.validation.min !== undefined && field.validation.min !== '' ? `min ${field.validation.min}` : '',
                                            field.validation.max !== undefined && field.validation.max !== '' ? `max ${field.validation.max}` : '',
                                            field.validation.minLength !== undefined ? `minLength ${field.validation.minLength}` : '',
                                            field.validation.maxLength !== undefined ? `maxLength ${field.validation.maxLength}` : '',
                                            field.validation.pattern ? `pattern ${field.validation.pattern}` : '',
                                        ].filter(Boolean).join(' • ') || 'None'}
                                    </div>
                                )}
                            </li>
                        ))}
                    </ul>
                )}
            </Card>
        </div>
    );
};

export default FormDetails;

