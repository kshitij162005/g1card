import React, { useState } from 'react';
import Card from '../../components/Card';
import { useAuth } from '../../contexts/AuthContext';
import { useNavigate, useLocation } from 'react-router-dom';

type FieldType = 'text' | 'textarea' | 'number' | 'date' | 'select' | 'file';

interface FieldItem {
    id: string;
    label: string;
    key: string;
    type: FieldType;
    required?: boolean;
    options?: string[];
}

const defaultField = (i = 0): FieldItem => ({ id: `f${Date.now()}${i}`, label: 'New Field', key: `field_${i}`, type: 'text', required: false, options: [] });

const CreateForm: React.FC = () => {
    const { user } = useAuth();
    const [name, setName] = useState('');
    const [description, setDescription] = useState('');
    const [fields, setFields] = useState<FieldItem[]>([defaultField(0)]);
    const navigate = useNavigate();
    const loc = useLocation();

    // support cloning via query ?clone=formId (not fully implemented client-side)
    const addField = () => setFields(prev => [...prev, defaultField(prev.length)]);
    const removeField = (idx: number) => setFields(prev => prev.filter((_, i) => i !== idx));
    const updateField = (idx: number, patch: Partial<FieldItem>) => setFields(prev => prev.map((f, i) => i === idx ? { ...f, ...patch } : f));

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!user) return alert('Not authenticated');
        if (!name.trim()) return alert('Form name required');
        try {
            const payload = { name: name.trim(), description, fields: fields.map(f => ({ label: f.label, key: f.key, type: f.type, required: !!f.required, options: f.options || [] })) };
            const resp = await fetch(`http://localhost:8082/api/hospitals/${user.id}/forms`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) });
            const d = await resp.json();
            if (!resp.ok) throw new Error(d.error || 'Failed to create');
            alert('Form template created');
            navigate('/hospital/forms');
        } catch (err) { console.error('create form', err); alert('Error creating form'); }
    };

    return (
        <Card title="Create Form Template">
            <form onSubmit={handleSubmit} className="space-y-6">
                <div>
                    <label className="block text-sm font-medium text-slate-700 dark:text-slate-300">Form Name</label>
                    <input value={name} onChange={e => setName(e.target.value)} className="mt-1 block w-full px-3 py-2 border rounded-lg" />
                </div>
                <div>
                    <label className="block text-sm font-medium text-slate-700 dark:text-slate-300">Description</label>
                    <textarea value={description} onChange={e => setDescription(e.target.value)} className="mt-1 block w-full px-3 py-2 border rounded-lg" />
                </div>

                <div className="space-y-4">
                    <h4 className="text-sm font-medium text-slate-700 dark:text-slate-300">Fields</h4>
                    {fields.map((f, idx) => (
                        <div key={f.id} className="p-4 border rounded-lg bg-slate-50 dark:bg-slate-700/50">
                            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                                <div>
                                    <label className="block text-xs">Label</label>
                                    <input value={f.label} onChange={e => updateField(idx, { label: e.target.value })} className="mt-1 block w-full px-2 py-1 border rounded" />
                                </div>
                                <div>
                                    <label className="block text-xs">Key (identifier)</label>
                                    <input value={f.key} onChange={e => updateField(idx, { key: e.target.value })} className="mt-1 block w-full px-2 py-1 border rounded" />
                                </div>
                                <div>
                                    <label className="block text-xs">Type</label>
                                    <select value={f.type} onChange={e => updateField(idx, { type: e.target.value as FieldType })} className="mt-1 block w-full px-2 py-1 border rounded">
                                        <option value="text">Text</option>
                                        <option value="textarea">Textarea</option>
                                        <option value="number">Number</option>
                                        <option value="date">Date</option>
                                        <option value="select">Select</option>
                                        <option value="file">File (image/doc)</option>
                                    </select>
                                </div>
                            </div>
                            <div className="mt-3 flex items-center gap-4">
                                <label className="flex items-center gap-2"><input type="checkbox" checked={!!f.required} onChange={e => updateField(idx, { required: e.target.checked })} /> Required</label>
                                {f.type === 'select' && (
                                    <div className="flex-1">
                                        <label className="block text-xs">Options (comma separated)</label>
                                        <input value={(f.options || []).join(',')} onChange={e => updateField(idx, { options: e.target.value.split(',').map(s => s.trim()).filter(Boolean) })} className="mt-1 block w-full px-2 py-1 border rounded" />
                                    </div>
                                )}
                                <div className="ml-auto">
                                    <button type="button" onClick={() => removeField(idx)} className="px-3 py-1 text-sm border rounded text-rose-600">Remove</button>
                                </div>
                            </div>
                        </div>
                    ))}
                    <div>
                        <button type="button" onClick={addField} className="px-4 py-2 border rounded">+ Add Field</button>
                    </div>
                </div>

                <div className="flex justify-end gap-2">
                    <button type="button" onClick={() => navigate(-1)} className="px-4 py-2 border rounded">Cancel</button>
                    <button type="submit" className="px-4 py-2 bg-brand-primary text-white rounded">Create Template</button>
                </div>
            </form>
        </Card>
    );
};

export default CreateForm;
