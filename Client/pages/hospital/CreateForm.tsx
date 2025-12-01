import React, { useEffect, useState } from 'react';
import Card from '../../components/Card';
import { useAuth } from '../../contexts/AuthContext';
import { useNavigate, useLocation, useParams } from 'react-router-dom';

type FieldType = 'text' | 'textarea' | 'number' | 'date' | 'select' | 'file';

interface FieldItem {
    id: string;
    label: string;
    key: string;
    type: FieldType;
    required?: boolean;
    options?: string[];
    multiSelect?: boolean;
}

const slugify = (value: string): string => {
    return value
        .toLowerCase()
        .trim()
        .replace(/[^a-z0-9]+/g, '_')
        .replace(/^_+|_+$/g, '');
};

const ensureUniqueKey = (base: string, existing: string[]): string => {
    let key = base || 'field';
    let counter = 1;
    while (existing.includes(key)) {
        key = `${base || 'field'}_${counter++}`;
    }
    return key;
};

const buildField = (label: string, idx: number, existingKeys: string[]): FieldItem => {
    const base = slugify(label) || `field_${idx + 1}`;
    const key = ensureUniqueKey(base, existingKeys);
    return {
        id: `f${Date.now()}${idx}`,
        label,
        key,
        type: 'text',
        required: false,
        options: [],
        multiSelect: false,
    };
};

const CreateForm: React.FC = () => {
    const { user } = useAuth();
    const [name, setName] = useState('');
    const [description, setDescription] = useState('');
    const [fields, setFields] = useState<FieldItem[]>(() => [buildField('Field 1', 0, [])]);
    const [loadingTemplate, setLoadingTemplate] = useState(false);
    const navigate = useNavigate();
    const loc = useLocation();
    const { formId } = useParams<{ formId?: string }>();
    const isEditing = Boolean(formId);

    const addField = () => setFields(prev => {
        const label = `Field ${prev.length + 1}`;
        const existingKeys = prev.map(f => f.key);
        const newField = buildField(label, prev.length, existingKeys);
        return [...prev, newField];
    });

    const removeField = (idx: number) => setFields(prev => prev.filter((_, i) => i !== idx));

    const updateField = (idx: number, patch: Partial<FieldItem>) => setFields(prev => prev.map((f, i) => {
        if (i !== idx) return f;
        const updated: FieldItem = { ...f, ...patch };

        if (patch.label !== undefined) {
            const otherKeys = prev.filter((_, j) => j !== idx).map(field => field.key);
            const base = slugify(patch.label) || `field_${idx + 1}`;
            updated.key = ensureUniqueKey(base, otherKeys);
        }

        if (patch.type && patch.type !== f.type) {
            if (patch.type === 'select') {
                updated.options = (f.options && f.options.length > 0) ? f.options : [''];
                updated.multiSelect = f.multiSelect || false;
            } else {
                updated.options = [];
                updated.multiSelect = false;
            }
        }

        if (patch.options !== undefined) {
            updated.options = patch.options;
        }

        return updated;
    }));

    useEffect(() => {
        const params = new URLSearchParams(loc.search);
        const cloneId = params.get('clone');
        const targetId = isEditing ? formId : cloneId;
        if (!user || !targetId) return;
        const loadTemplate = async () => {
            setLoadingTemplate(true);
            try {
                const resp = await fetch(`http://localhost:8082/api/hospitals/${user.id}/forms/${targetId}`);
                const data = await resp.json();
                if (!resp.ok) throw new Error(data.error || 'Failed to load form');
                setName(isEditing ? data.form.name : `${data.form.name} (Copy)`);
                setDescription(data.form.description || '');
                                const mappedFields: FieldItem[] = (data.form.fields || []).map((f: any, idx: number) => ({
                        id: f.id || `f${Date.now()}${idx}`,
                        label: f.label,
                        key: f.key,
                        type: f.type,
                        required: !!f.required,
                        options: f.options || [],
                        multiSelect: !!f.multiSelect,
                    }));
                if (!mappedFields.length) {
                    setFields(isEditing ? [] : [buildField('Field 1', 0, [])]);
                } else if (isEditing) {
                    setFields(mappedFields);
                } else {
                    const assigned = new Set<string>();
                    const regenerated = mappedFields.map((f, idx) => {
                        const base = slugify(f.label) || `field_${idx + 1}`;
                        let keyCandidate = base;
                        let counter = 1;
                        while (!keyCandidate || assigned.has(keyCandidate)) {
                            keyCandidate = `${base || 'field'}_${counter++}`;
                        }
                        assigned.add(keyCandidate);
                        return { ...f, key: keyCandidate };
                    });
                    setFields(regenerated);
                }
            } catch (err) {
                console.error('load form template', err);
                if (isEditing) alert('Failed to load form. Please retry.');
            } finally {
                setLoadingTemplate(false);
            }
        };
        loadTemplate();
    }, [user, formId, loc.search, isEditing]);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!user) return alert('Not authenticated');
        if (!name.trim()) return alert('Form name required');
        for (const f of fields) {
            if (!f.label.trim()) return alert('Every field must have a label');
        }
        
        // Validate select fields have at least one option
        for (const f of fields) {
            if (f.type === 'select' && (!f.options || f.options.length === 0 || f.options.every(opt => !opt.trim()))) {
                return alert(`Field "${f.label}" is a select field but has no valid options. Please add at least one option.`);
            }
        }

        // Check for duplicate form names
        try {
            const checkResp = await fetch(`http://localhost:8082/api/hospitals/${user.id}/forms/check-name?name=${encodeURIComponent(name.trim())}${isEditing ? `&excludeId=${formId}` : ''}`);
            const checkData = await checkResp.json();
            if (!checkResp.ok) throw new Error(checkData.error || 'Failed to check name');
            if (checkData.exists) {
                return alert('A form template with this name already exists. Please choose a different name.');
            }
        } catch (err) {
            console.error('check form name', err);
            return alert('Error checking form name. Please try again.');
        }
        
        // Filter out empty options before submitting
        const cleanedFields = fields.map(f => ({
            label: f.label,
            key: f.key,
            type: f.type,
            required: !!f.required,
            options: f.type === 'select' ? (f.options || []).filter(opt => opt.trim()) : [],
            multiSelect: f.type === 'select' ? !!f.multiSelect : false
        }));
        
        try {
            const payload = { name: name.trim(), description, fields: cleanedFields };
            const endpoint = isEditing
                ? `http://localhost:8082/api/hospitals/${user.id}/forms/${formId}`
                : `http://localhost:8082/api/hospitals/${user.id}/forms`;
            const method = isEditing ? 'PATCH' : 'POST';
            const resp = await fetch(endpoint, { method, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) });
            const d = await resp.json();
            if (!resp.ok) throw new Error(d.error || 'Failed to create');
            alert(isEditing ? 'Form template updated' : 'Form template created');
            navigate('/hospital/forms');
        } catch (err) { console.error('create form', err); alert('Error creating form'); }
    };

    const pageTitle = isEditing ? 'Edit Form Template' : 'Create Form Template';
    const submitLabel = isEditing ? 'Save Changes' : 'Create Template';

    return (
        <div className="space-y-6">
            <div className="flex justify-between items-center">
                <h2 className="text-2xl font-bold text-slate-800 dark:text-slate-200">{pageTitle}</h2>
                <button onClick={() => navigate('/hospital/forms')} className="px-4 py-2 bg-slate-200 dark:bg-slate-700 text-slate-800 dark:text-slate-200 text-sm rounded-lg hover:bg-slate-300 dark:hover:bg-slate-600">&larr; Back</button>
            </div>
            <Card>
                <form onSubmit={handleSubmit} className="space-y-6">
                    <div>
                        <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">Form Name *</label>
                        <input 
                            value={name} 
                            onChange={e => setName(e.target.value)} 
                            placeholder="e.g., Dental Checkup, General Consultation"
                            className="mt-1 block w-full px-4 py-2.5 border border-slate-300 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 placeholder:text-slate-400 dark:placeholder:text-slate-500 focus:ring-2 focus:ring-brand-accent focus:border-brand-accent outline-none transition-all" 
                        />
                    </div>
                    <div>
                        <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">Description</label>
                        <textarea 
                            value={description} 
                            onChange={e => setDescription(e.target.value)} 
                            placeholder="Brief description of what this form is used for..."
                            rows={3}
                            className="mt-1 block w-full px-4 py-2.5 border border-slate-300 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 placeholder:text-slate-400 dark:placeholder:text-slate-500 focus:ring-2 focus:ring-brand-accent focus:border-brand-accent outline-none transition-all resize-none" 
                        />
                    </div>

                    <div className="space-y-4">
                        <div className="flex justify-between items-center">
                            <h4 className="text-lg font-semibold text-slate-800 dark:text-slate-200">Form Fields</h4>
                            <button type="button" onClick={addField} className="px-4 py-2 bg-brand-primary text-white text-sm rounded-lg hover:bg-brand-secondary transition-all flex items-center gap-2">
                                <span>+</span> Add Field
                            </button>
                        </div>
                        {loadingTemplate ? (
                            <p className="text-sm text-slate-500 dark:text-slate-400">Loading form details...</p>
                        ) : fields.length === 0 ? (
                            <div className="text-center py-8 text-slate-500 dark:text-slate-400 border-2 border-dashed border-slate-300 dark:border-slate-600 rounded-lg">
                                <p>No fields added yet. Click "+ Add Field" to get started.</p>
                            </div>
                        ) : (
                        fields.map((f, idx) => (
                            <div key={f.id} className="p-5 border border-slate-300 dark:border-slate-600 rounded-lg bg-slate-50 dark:bg-slate-800/50 shadow-sm">
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
                                    <div>
                                        <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">Field Label *</label>
                                        <input 
                                            value={f.label} 
                                            onChange={e => updateField(idx, { label: e.target.value })} 
                                            placeholder="e.g., Patient Name"
                                            className="block w-full px-3 py-2 border border-slate-300 dark:border-slate-600 rounded-md bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100 placeholder:text-slate-400 dark:placeholder:text-slate-500 focus:ring-2 focus:ring-brand-accent focus:border-brand-accent outline-none text-sm" 
                                        />
                                    </div>
                                    <div>
                                        <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">Field Type *</label>
                                        <select 
                                            value={f.type} 
                                            onChange={e => updateField(idx, { type: e.target.value as FieldType })} 
                                            className="block w-full px-3 py-2 border border-slate-300 dark:border-slate-600 rounded-md bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100 focus:ring-2 focus:ring-brand-accent focus:border-brand-accent outline-none text-sm"
                                        >
                                            <option value="text">Text</option>
                                            <option value="textarea">Textarea</option>
                                            <option value="number">Number</option>
                                            <option value="date">Date</option>
                                            <option value="select">Select (Dropdown)</option>
                                            <option value="file">File (Image/Document)</option>
                                        </select>
                                    </div>
                                </div>
                                <div className="flex flex-wrap items-center gap-4 pt-3 border-t border-slate-200 dark:border-slate-700">
                                    <label className="flex items-center gap-2 text-sm text-slate-700 dark:text-slate-300 cursor-pointer">
                                        <input 
                                            type="checkbox" 
                                            checked={!!f.required} 
                                            onChange={e => updateField(idx, { required: e.target.checked })} 
                                            className="w-4 h-4 text-brand-primary border-slate-300 dark:border-slate-600 rounded focus:ring-brand-accent"
                                        /> 
                                        <span>Required Field</span>
                                    </label>
                                    {f.type === 'select' && (
                                        <div className="flex-1 min-w-[300px]">
                                            <div className="flex items-center justify-between mb-2">
                                                <label className="block text-xs font-medium text-slate-700 dark:text-slate-300">Dropdown Options</label>
                                                <label className="flex items-center gap-2 text-xs text-slate-700 dark:text-slate-300 cursor-pointer">
                                                    <input 
                                                        type="checkbox" 
                                                        checked={!!f.multiSelect} 
                                                        onChange={e => updateField(idx, { multiSelect: e.target.checked })} 
                                                        className="w-3.5 h-3.5 text-brand-primary border-slate-300 dark:border-slate-600 rounded focus:ring-brand-accent"
                                                    /> 
                                                    <span>Allow Multiple Selection</span>
                                                </label>
                                            </div>
                                            <div className="space-y-2">
                                                {(f.options || []).map((opt, optIdx) => (
                                                    <div key={optIdx} className="flex items-center gap-2">
                                                        <input
                                                            type="text"
                                                            value={opt}
                                                            onChange={e => {
                                                                const newOptions = [...(f.options || [])];
                                                                newOptions[optIdx] = e.target.value;
                                                                updateField(idx, { options: newOptions });
                                                            }}
                                                            placeholder={`Option ${optIdx + 1}`}
                                                            className="flex-1 px-3 py-1.5 border border-slate-300 dark:border-slate-600 rounded-md bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100 placeholder:text-slate-400 dark:placeholder:text-slate-500 focus:ring-2 focus:ring-brand-accent focus:border-brand-accent outline-none text-sm"
                                                        />
                                                        <button
                                                            type="button"
                                                            onClick={() => {
                                                                const newOptions = (f.options || []).filter((_, i) => i !== optIdx);
                                                                updateField(idx, { options: newOptions });
                                                            }}
                                                            className="px-2 py-1.5 text-xs border border-rose-300 dark:border-rose-700 rounded-md text-rose-600 dark:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-900/20 transition-colors"
                                                        >
                                                            Remove
                                                        </button>
                                                    </div>
                                                ))}
                                                <button
                                                    type="button"
                                                    onClick={() => {
                                                        const newOptions = [...(f.options || []), ''];
                                                        updateField(idx, { options: newOptions });
                                                    }}
                                                    className="w-full px-3 py-1.5 text-xs border border-slate-300 dark:border-slate-600 rounded-md text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-700 transition-colors flex items-center justify-center gap-1"
                                                >
                                                    <span>+</span> Add Option
                                                </button>
                                                {(!f.options || f.options.length === 0) && (
                                                    <p className="text-xs text-slate-500 dark:text-slate-400 italic">No options added. Click "Add Option" to add dropdown choices.</p>
                                                )}
                                            </div>
                                        </div>
                                    )}
                                    <div className="ml-auto">
                                        <button 
                                            type="button" 
                                            onClick={() => removeField(idx)} 
                                            className="px-3 py-1.5 text-sm border border-rose-300 dark:border-rose-700 rounded-md text-rose-600 dark:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-900/20 transition-colors"
                                        >
                                            Remove
                                        </button>
                                    </div>
                                </div>
                            </div>
                        )))}
                    </div>

                    <div className="flex justify-end gap-3 pt-4 border-t border-slate-200 dark:border-slate-700">
                        <button 
                            type="button" 
                            onClick={() => navigate(-1)} 
                            className="px-6 py-2.5 border border-slate-300 dark:border-slate-600 rounded-lg text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-700 transition-colors"
                        >
                            Cancel
                        </button>
                        <button 
                            type="submit" 
                            className="px-6 py-2.5 bg-brand-primary text-white rounded-lg hover:bg-brand-secondary transition-colors shadow-sm hover:shadow-md disabled:opacity-50"
                            disabled={loadingTemplate}
                        >
                            {submitLabel}
                        </button>
                    </div>
                </form>
            </Card>
        </div>
    );
};

export default CreateForm;
