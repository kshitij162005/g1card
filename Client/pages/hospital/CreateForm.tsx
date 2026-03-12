import { API_URL } from '../../config/api';
import React, { useEffect, useMemo, useState } from 'react';
import { useAuth } from '../../contexts/AuthContext';
import { useLocation, useNavigate, useParams } from 'react-router-dom';

type FieldType =
    | 'text'
    | 'textarea'
    | 'number'
    | 'email'
    | 'tel'
    | 'date'
    | 'time'
    | 'select'
    | 'radio'
    | 'checkbox'
    | 'file'
    | 'section'
    | 'pageBreak';

interface FieldValidation {
    min?: string;
    max?: string;
    minLength?: number;
    maxLength?: number;
    pattern?: string;
    customError?: string;
}

interface FileSettings {
    allowedTypes: string[];
    maxFileSizeMB: number;
    maxFiles: number;
}

interface FieldItem {
    id: string;
    label: string;
    key: string;
    type: FieldType;
    required: boolean;
    description: string;
    placeholder: string;
    options: string[];
    allowMultiple: boolean;
    validation: FieldValidation;
    fileSettings: FileSettings;
}

interface ThemeSettings {
    primaryColor: string;
    backgroundColor: string;
    cardColor: string;
    fontFamily: string;
}

const DEFAULT_THEME: ThemeSettings = {
    primaryColor: '#3b82f6',
    backgroundColor: '#0f172a',
    cardColor: '#1e293b',
    fontFamily: 'inherit',
};

interface LocalDraft {
    name: string;
    description: string;
    fields: FieldItem[];
}

const FIELD_PICKER_GROUPS: Array<{ title: string; items: Array<{ type: FieldType; label: string; hint: string }> }> = [
    {
        title: 'Basic Fields',
        items: [
            { type: 'text', label: 'Short Text', hint: 'Single line input' },
            { type: 'textarea', label: 'Paragraph', hint: 'Long answer input' },
            { type: 'number', label: 'Number', hint: 'Numeric answer' },
            { type: 'email', label: 'Email', hint: 'Email format validation' },
            { type: 'tel', label: 'Phone', hint: 'Phone number input' },
            { type: 'date', label: 'Date', hint: 'Calendar date picker' },
            { type: 'time', label: 'Time', hint: 'Time selector' },
        ],
    },
    {
        title: 'Choices',
        items: [
            { type: 'select', label: 'Dropdown', hint: 'Choose one from list' },
            { type: 'radio', label: 'Single Choice', hint: 'Radio options' },
            { type: 'checkbox', label: 'Multiple Choice', hint: 'Select multiple options' },
        ],
    },
    {
        title: 'Uploads',
        items: [{ type: 'file', label: 'File Upload', hint: 'Accept file attachments' }],
    },
    {
        title: 'Structure',
        items: [
            { type: 'section', label: 'Section', hint: 'Add heading and context' },
            { type: 'pageBreak', label: 'Page Break', hint: 'Split into multiple pages' },
        ],
    },
];

const FIELD_TYPE_OPTIONS: Array<{ value: FieldType; label: string }> = [
    { value: 'text', label: 'Short Text' },
    { value: 'textarea', label: 'Paragraph' },
    { value: 'number', label: 'Number' },
    { value: 'email', label: 'Email' },
    { value: 'tel', label: 'Phone' },
    { value: 'date', label: 'Date' },
    { value: 'time', label: 'Time' },
    { value: 'select', label: 'Dropdown' },
    { value: 'radio', label: 'Single Choice' },
    { value: 'checkbox', label: 'Multiple Choice' },
    { value: 'file', label: 'File Upload' },
    { value: 'section', label: 'Section' },
    { value: 'pageBreak', label: 'Page Break' },
];

const slugify = (value: string) =>
    value
        .toLowerCase()
        .trim()
        .replace(/[^a-z0-9]+/g, '_')
        .replace(/^_+|_+$/g, '');

const ensureUniqueKey = (base: string, existing: string[]) => {
    let key = base || 'field';
    let i = 1;
    while (existing.includes(key)) key = `${base || 'field'}_${i++}`;
    return key;
};

const isChoiceType = (type: FieldType) => type === 'select' || type === 'radio' || type === 'checkbox';
const isLengthType = (type: FieldType) => type === 'text' || type === 'textarea' || type === 'email' || type === 'tel';
const isRangeType = (type: FieldType) => type === 'number' || type === 'date' || type === 'time';
const isStructural = (type: FieldType) => type === 'section' || type === 'pageBreak';

const createField = (type: FieldType, idx: number, existingKeys: string[]): FieldItem => {
    const label = type === 'section' ? 'Section Title' : type === 'pageBreak' ? 'Page Break' : `Question ${idx + 1}`;
    return {
        id: `f_${Date.now()}_${idx}`,
        label,
        key: ensureUniqueKey(slugify(label) || `field_${idx + 1}`, existingKeys),
        type,
        required: false,
        description: '',
        placeholder: '',
        options: isChoiceType(type) ? ['Option 1'] : [],
        allowMultiple: type === 'checkbox' || type === 'file',
        validation: {},
        fileSettings: {
            allowedTypes: ['PDF', 'Image'],
            maxFileSizeMB: 10,
            maxFiles: 1,
        },
    };
};

const move = <T,>(arr: T[], from: number, to: number) => {
    const next = [...arr];
    const [item] = next.splice(from, 1);
    next.splice(to, 0, item);
    return next;
};

const TypePickerModal: React.FC<{
    open: boolean;
    onClose: () => void;
    onSelect: (type: FieldType) => void;
}> = ({ open, onClose, onSelect }) => {
    if (!open) return null;
    return (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm p-4" onClick={onClose}>
            <div className="mx-auto mt-4 w-full max-w-3xl max-h-[calc(100vh-2rem)] overflow-y-auto rounded-2xl bg-slate-900 border border-slate-700 p-6 shadow-2xl shadow-black/40" onClick={e => e.stopPropagation()}>
                <div className="flex items-start justify-between mb-6">
                    <div>
                        <h3 className="text-[28px] font-bold text-slate-100">Add Question Type</h3>
                        <p className="text-[15px] text-slate-400 mt-1">Pick the field type that best matches the answer you want.</p>
                    </div>
                    <button type="button" onClick={onClose} className="px-3 py-1.5 rounded-md text-[15px] text-slate-300 hover:bg-slate-800">Close</button>
                </div>
                <div className="space-y-6">
                    {FIELD_PICKER_GROUPS.map(group => (
                        <section key={group.title}>
                            <p className="text-[15px] font-semibold text-slate-200 mb-3">{group.title}</p>
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                                {group.items.map(item => (
                                    <button
                                        key={item.type}
                                        type="button"
                                        onClick={() => {
                                            onSelect(item.type);
                                            onClose();
                                        }}
                                        className="text-left px-4 py-3 rounded-xl text-[15px] border border-slate-700 bg-slate-800/40 text-slate-100 hover:border-blue-400 hover:bg-slate-800 hover:-translate-y-0.5 transition-all duration-200"
                                    >
                                        <p className="font-semibold">{item.label}</p>
                                        <p className="text-[13px] text-slate-400 mt-1">{item.hint}</p>
                                    </button>
                                ))}
                            </div>
                        </section>
                    ))}
                </div>
            </div>
        </div>
    );
};

const CreateForm: React.FC = () => {
    const { user } = useAuth();
    const navigate = useNavigate();
    const loc = useLocation();
    const { formId } = useParams<{ formId?: string }>();
    const isEditing = Boolean(formId);

    const [name, setName] = useState('');
    const [description, setDescription] = useState('');
    const [fields, setFields] = useState<FieldItem[]>([]);
    const [activeField, setActiveField] = useState(0);
    const [dragFrom, setDragFrom] = useState<number | null>(null);
    const [loading, setLoading] = useState(false);
    const [previewOpen, setPreviewOpen] = useState(false);
    const [pickerOpen, setPickerOpen] = useState(false);
    const [theme] = useState<ThemeSettings>(DEFAULT_THEME);
    const [draftHydrated, setDraftHydrated] = useState(false);

    const currentField = fields[activeField] || null;
    const params = useMemo(() => new URLSearchParams(loc.search), [loc.search]);
    const cloneId = params.get('clone');
    const targetId = isEditing ? formId || '' : cloneId || '';
    const isCreateFresh = !isEditing && !cloneId;
    const localDraftKey = useMemo(() => {
        if (!user?.id) return '';
        return `g1card:form-builder:${user.id}:${targetId || 'new'}`;
    }, [user?.id, targetId]);

    useEffect(() => {
        if (!user) return;
        if (!targetId) return;

        (async () => {
            setLoading(true);
            try {
                const resp = await fetch(`${API_URL}/hospitals/${user.id}/forms/${targetId}`);
                const data = await resp.json();
                if (!resp.ok) throw new Error(data.error || 'Failed to load form');
                setName(isEditing ? data.form.name : `${data.form.name} (Copy)`);
                setDescription(data.form.description || '');
                const mapped: FieldItem[] = (data.form.fields || []).map((f: any, idx: number) => ({
                    id: f.id || `f_${Date.now()}_${idx}`,
                    label: f.label || 'Untitled',
                    key: f.key || `field_${idx + 1}`,
                    type: (f.type || 'text') as FieldType,
                    required: !!f.required,
                    description: f.description || '',
                    placeholder: f.placeholder || '',
                    options: Array.isArray(f.options) ? f.options : [],
                    allowMultiple: !!(f.allowMultiple || f.multiSelect),
                    validation: {
                        min: f.validation?.min || '',
                        max: f.validation?.max || '',
                        minLength: f.validation?.minLength,
                        maxLength: f.validation?.maxLength,
                        pattern: f.validation?.pattern || '',
                        customError: f.validation?.customError || '',
                    },
                    fileSettings: {
                        allowedTypes: Array.isArray(f.fileSettings?.allowedTypes) ? f.fileSettings.allowedTypes : ['PDF', 'Image'],
                        maxFileSizeMB: Number(f.fileSettings?.maxFileSizeMB || 10),
                        maxFiles: Number(f.fileSettings?.maxFiles || 1),
                    },
                }));
                setFields(mapped);
                setActiveField(0);
            } catch (err) {
                console.error(err);
                notify('Failed to load form');
                setFields([]);
            } finally {
                setLoading(false);
            }
        })();
    }, [user, targetId]);

    useEffect(() => {
        if (!user || !localDraftKey || !isCreateFresh || draftHydrated) return;
        try {
            const raw = localStorage.getItem(localDraftKey);
            if (!raw) {
                setDraftHydrated(true);
                return;
            }
            const parsed = JSON.parse(raw) as LocalDraft;
            if (typeof parsed.name === 'string') setName(parsed.name);
            if (typeof parsed.description === 'string') setDescription(parsed.description);
            if (Array.isArray(parsed.fields)) setFields(parsed.fields);
        } catch (err) {
            console.error('draft hydrate error', err);
        } finally {
            setDraftHydrated(true);
        }
    }, [user, localDraftKey, isCreateFresh, draftHydrated]);

    useEffect(() => {
        if (!localDraftKey || !draftHydrated || !isCreateFresh) return;
        const draft: LocalDraft = { name, description, fields };
        localStorage.setItem(localDraftKey, JSON.stringify(draft));
    }, [localDraftKey, draftHydrated, isCreateFresh, name, description, fields]);

    const canSave = useMemo(() => {
        if (!name.trim()) return false;
        if (fields.length === 0) return false;
        for (const f of fields) {
            if (f.type !== 'pageBreak' && !f.label.trim()) return false;
            if (!isStructural(f.type) && !f.key.trim()) return false;
            if (isChoiceType(f.type) && f.options.filter(v => v.trim()).length === 0) return false;
        }
        return true;
    }, [name, fields]);

    const addField = (type: FieldType) => {
        setFields(prev => {
            const next = [...prev, createField(type, prev.length, prev.map(f => f.key))];
            setActiveField(next.length - 1);
            return next;
        });
    };

    const updateField = (idx: number, patch: Partial<FieldItem>) => {
        setFields(prev =>
            prev.map((f, i) => {
                if (i !== idx) return f;
                const updated = { ...f, ...patch };
                if (patch.label !== undefined && !isStructural(updated.type)) {
                    const otherKeys = prev.filter((_, j) => j !== idx).map(x => x.key);
                    updated.key = ensureUniqueKey(slugify(patch.label) || `field_${idx + 1}`, otherKeys);
                }
                if (patch.type && patch.type !== f.type) {
                    updated.options = isChoiceType(patch.type) ? ['Option 1'] : [];
                    updated.allowMultiple = patch.type === 'checkbox' || patch.type === 'file';
                    if (isStructural(patch.type)) {
                        updated.required = false;
                        updated.placeholder = '';
                    }
                }
                return updated;
            })
        );
    };

    const duplicateField = (idx: number) => {
        setFields(prev => {
            const src = prev[idx];
            if (!src) return prev;
            const copy: FieldItem = {
                ...src,
                id: `f_${Date.now()}_copy_${idx}`,
                key: ensureUniqueKey(`${src.key}_copy`, prev.map(f => f.key)),
                label: `${src.label} (Copy)`,
                options: [...src.options],
                validation: { ...src.validation },
                fileSettings: { ...src.fileSettings },
            };
            const next = [...prev];
            next.splice(idx + 1, 0, copy);
            setActiveField(idx + 1);
            return next;
        });
    };

    const removeField = (idx: number) => {
        setFields(prev => {
            if (prev.length <= 1) return prev;
            const next = prev.filter((_, i) => i !== idx);
            setActiveField(Math.max(0, Math.min(idx - 1, next.length - 1)));
            return next;
        });
    };

    const moveField = (idx: number, direction: 'up' | 'down') => {
        const to = direction === 'up' ? idx - 1 : idx + 1;
        if (to < 0 || to >= fields.length) return;
        setFields(prev => move(prev, idx, to));
        setActiveField(to);
    };

    const handleDrop = (to: number) => {
        if (dragFrom === null) return;
        if (dragFrom !== to) {
            setFields(prev => move(prev, dragFrom, to));
            setActiveField(to);
        }
        setDragFrom(null);
    };

    const saveForm = async (publish = false) => {
        if (!user) return notify('Not authenticated');
        if (!canSave) return notify('Please complete required fields first');

        try {
            const checkResp = await fetch(`${API_URL}/hospitals/${user.id}/forms/check-name?name=${encodeURIComponent(name.trim())}${isEditing ? `&excludeId=${formId}` : ''}`);
            const checkData = await checkResp.json();
            if (!checkResp.ok) throw new Error(checkData.error || 'Name check failed');
            if (checkData.exists) return notify('A form with this name already exists');

            const used = new Set<string>();
            const payloadFields = fields.map((f, idx) => {
                const base = slugify(f.key || f.label || `field_${idx + 1}`) || `field_${idx + 1}`;
                let key = base;
                let i = 1;
                while (used.has(key)) key = `${base}_${i++}`;
                used.add(key);
                return {
                    id: f.id,
                    label: f.type === 'pageBreak' ? (f.label || 'Page Break') : f.label.trim(),
                    key,
                    type: f.type,
                    required: isStructural(f.type) ? false : f.required,
                    description: f.description,
                    placeholder: isStructural(f.type) ? '' : f.placeholder,
                    options: isChoiceType(f.type) ? f.options.map(o => o.trim()).filter(Boolean) : [],
                    allowMultiple: f.allowMultiple,
                    validation: isStructural(f.type) ? {} : f.validation,
                    fileSettings: f.type === 'file' ? f.fileSettings : undefined,
                };
            });

            const payload = {
                name: name.trim(),
                description: description.trim(),
                fields: payloadFields,
                theme,
                active: publish,
                hasBeenPublished: publish ? true : undefined,
                publishIntent: publish,
            };

            const endpoint = isEditing ? `${API_URL}/hospitals/${user.id}/forms/${formId}` : `${API_URL}/hospitals/${user.id}/forms`;
            const method = isEditing ? 'PATCH' : 'POST';
            const resp = await fetch(endpoint, {
                method,
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload),
            });
            const data = await resp.json();
            if (!resp.ok) throw new Error(data.error || 'Save failed');

            if (localDraftKey) localStorage.removeItem(localDraftKey);
            notify(publish ? 'Form published successfully' : 'Draft saved successfully');
            navigate('/hospital/forms');
        } catch (err) {
            console.error(err);
            notify('Unable to save form');
        }
    };

    const renderInputPreview = (field: FieldItem) => {
        if (field.type === 'section') return null;
        if (field.type === 'pageBreak') {
            return <div className="border-t-2 border-dashed border-slate-600 pt-2 text-sm text-slate-400">Page Break</div>;
        }
        if (field.type === 'textarea') {
            return (
                <div className="h-16 rounded-md bg-slate-900/80 shadow-inner px-3 py-2 text-[15px] text-slate-500">
                    {field.placeholder || 'Long answer text'}
                </div>
            );
        }
        if (field.type === 'select') {
            return (
                <div className="h-11 rounded-md bg-slate-900/80 shadow-inner flex items-center px-3 text-[15px] text-slate-500">
                    {field.placeholder || 'Select an option'}
                </div>
            );
        }
        if (field.type === 'radio' || field.type === 'checkbox') {
            return (
                <div className="space-y-2 text-[15px] text-slate-300">
                    {field.options.map(opt => (
                        <div key={opt} className="flex items-center gap-2">
                            <span className="text-slate-400">{field.type === 'radio' ? '○' : '☐'}</span>
                            <span>{opt}</span>
                        </div>
                    ))}
                </div>
            );
        }
        if (field.type === 'file') return <div className="h-11 rounded-md bg-slate-900/80 shadow-inner flex items-center px-3 text-[15px] text-slate-500">{field.placeholder || 'Choose file'}</div>;
        return (
            <div className="h-11 rounded-md bg-slate-900/80 shadow-inner flex items-center px-3 text-[15px] text-slate-500">
                {field.placeholder || 'Enter value'}
            </div>
        );
    };

    return (
        <div className="min-h-screen p-8" style={{ backgroundColor: '#0f172a' }}>
            <div className="mx-auto max-w-[1500px] space-y-6">
                <header className="flex flex-col lg:flex-row lg:items-start lg:justify-between gap-6 pb-4 border-b border-slate-700/60">
                    <div>
                        <h1 className="text-[28px] font-bold text-slate-100">Form Builder</h1>
                        <p className="text-[15px] text-slate-400 mt-1">Design forms with a focused, content-first editing flow.</p>
                    </div>
                    <div className="flex flex-wrap items-center gap-2">
                        <button type="button" onClick={() => setPreviewOpen(true)} className="px-4 py-2 rounded-lg text-[15px] text-slate-200 hover:bg-slate-800/70 hover:text-white transition-all duration-200">Preview</button>
                        <button type="button" onClick={() => saveForm(false)} disabled={!canSave || loading} className="px-4 py-2 rounded-lg text-[15px] text-slate-200 border border-slate-700 hover:bg-slate-800/70 hover:text-white disabled:opacity-50 transition-all duration-200">Save Draft</button>
                        <button type="button" onClick={() => saveForm(true)} className="px-5 py-2 rounded-lg text-[15px] text-white shadow-sm hover:shadow-md hover:-translate-y-0.5 transition-all duration-200" style={{ backgroundColor: '#3b82f6' }}>Publish</button>
                    </div>
                </header>

                <div className="grid grid-cols-1 xl:grid-cols-[minmax(0,1fr)_360px] gap-6">
                    <main className="space-y-6">
                        <div className="mx-auto max-w-[760px] rounded-2xl p-6 border border-slate-700/70 shadow-sm shadow-black/20" style={{ backgroundColor: '#1e293b' }}>
                            <input
                                value={name}
                                onChange={e => setName(e.target.value)}
                                placeholder="Form Title"
                                className="w-full text-[28px] font-bold bg-transparent text-slate-100 placeholder:text-slate-500 outline-none"
                            />
                            <textarea
                                value={description}
                                onChange={e => setDescription(e.target.value)}
                                placeholder="Describe what this form is for"
                                rows={2}
                                className="mt-3 w-full text-[15px] bg-transparent text-slate-300 placeholder:text-slate-500 outline-none resize-none"
                            />
                        </div>

                        <div className="mx-auto max-w-[760px]">
                            {fields.length === 0 ? (
                                <div className="text-center py-20 rounded-2xl border border-slate-700/70 shadow-sm shadow-black/20" style={{ backgroundColor: '#1e293b' }}>
                                    <p className="text-[18px] font-semibold text-slate-100">Start building your form</p>
                                    <button
                                        type="button"
                                        onClick={() => setPickerOpen(true)}
                                        className="mt-4 px-5 py-2.5 rounded-full text-white text-[15px] hover:-translate-y-0.5 transition-all duration-200"
                                        style={{ backgroundColor: '#3b82f6' }}
                                    >
                                        + Add your first question
                                    </button>
                                </div>
                            ) : (
                                <div className="space-y-6">
                                    {fields.map((field, idx) => (
                                        <article
                                            key={field.id}
                                            draggable
                                            onDragStart={() => setDragFrom(idx)}
                                            onDragOver={e => e.preventDefault()}
                                            onDrop={() => handleDrop(idx)}
                                            onClick={() => setActiveField(idx)}
                                                className={`group rounded-[14px] p-5 border border-slate-700/60 transition-all duration-200 ${
                                                idx === activeField
                                                    ? 'ring-1 ring-blue-400 shadow-lg shadow-blue-950/20'
                                                    : 'hover:-translate-y-0.5 hover:shadow-md hover:shadow-black/30 hover:border-slate-500'
                                            }`}
                                            style={{ backgroundColor: '#1e293b', marginBottom: 24 }}
                                        >
                                            {field.type === 'section' ? (
                                                <div>
                                                    <p className="text-[18px] font-semibold text-slate-100">{field.label || 'Section Title'}</p>
                                                    <p className="text-[15px] text-slate-400 mt-1">{field.description || 'Section description'}</p>
                                                </div>
                                            ) : (
                                                <>
                                                    <div className="flex items-start justify-between gap-3">
                                                        <div className="flex-1">
                                                            <p className="text-[18px] font-semibold text-slate-100">{field.label || 'Untitled question'}</p>
                                                            {field.description && <p className="text-[15px] text-slate-400 mt-1">{field.description}</p>}
                                                        </div>
                                                        <span className="opacity-0 group-hover:opacity-100 text-slate-400 transition-opacity">⋮⋮</span>
                                                    </div>
                                                    <div className="mt-4">{renderInputPreview(field)}</div>
                                                    <div className="mt-4 opacity-0 group-hover:opacity-100 transition-opacity duration-200 flex items-center gap-2 text-sm text-slate-400">
                                                        <button type="button" onClick={() => moveField(idx, 'up')} disabled={idx === 0} className="h-8 w-8 inline-flex items-center justify-center rounded-md border border-slate-600 hover:bg-slate-800 disabled:opacity-40 disabled:cursor-not-allowed" title="Move up" aria-label="Move up">
                                                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 15l7-7 7 7" /></svg>
                                                        </button>
                                                        <button type="button" onClick={() => moveField(idx, 'down')} disabled={idx === fields.length - 1} className="h-8 w-8 inline-flex items-center justify-center rounded-md border border-slate-600 hover:bg-slate-800 disabled:opacity-40 disabled:cursor-not-allowed" title="Move down" aria-label="Move down">
                                                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" /></svg>
                                                        </button>
                                                        <button type="button" onClick={() => duplicateField(idx)} className="h-8 px-2 inline-flex items-center gap-1 rounded-md border border-slate-600 hover:bg-slate-800 hover:text-slate-100 transition-colors" title="Duplicate" aria-label="Duplicate">
                                                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2M10 8h8a2 2 0 012 2v8a2 2 0 01-2 2h-8a2 2 0 01-2-2v-8a2 2 0 012-2z" /></svg>
                                                            <span>Duplicate</span>
                                                        </button>
                                                        <button type="button" onClick={() => removeField(idx)} className="h-8 px-2 inline-flex items-center gap-1 rounded-md border border-rose-700/70 text-rose-300 hover:bg-rose-900/20 transition-colors" title="Delete" aria-label="Delete">
                                                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6M9 7V4a1 1 0 011-1h4a1 1 0 011 1v3M4 7h16" /></svg>
                                                            <span>Delete</span>
                                                        </button>
                                                    </div>
                                                </>
                                            )}
                                        </article>
                                    ))}

                                    <div className="flex justify-center pt-2">
                                        <button
                                            type="button"
                                            onClick={() => setPickerOpen(true)}
                                            className="w-12 h-12 rounded-full text-white text-2xl shadow-lg ring-4 ring-blue-500/20 hover:scale-105 hover:-translate-y-0.5 transition-all duration-200"
                                            style={{ backgroundColor: '#3b82f6' }}
                                        >
                                            +
                                        </button>
                                    </div>
                                </div>
                            )}
                        </div>
                    </main>

                    <aside className="builder-scrollbar sticky top-24 self-start max-h-[calc(100vh-7.5rem)] overflow-y-auto space-y-6 rounded-2xl p-6 border border-slate-700/70 shadow-sm shadow-black/20" style={{ backgroundColor: '#1e293b' }}>
                        <h3 className="text-[18px] font-semibold text-slate-100">Field Settings</h3>
                        {!currentField ? (
                            <p className="text-[15px] text-slate-400">Select a question to edit its settings.</p>
                        ) : (
                            <div className="space-y-6">
                                <section className="space-y-4">
                                    <p className="text-[18px] font-semibold text-slate-100">Basic</p>
                                    <div className="space-y-4">
                                        <div>
                                            <label className="text-[15px] text-slate-300">Field Type</label>
                                            <select
                                                value={currentField.type}
                                                onChange={e => updateField(activeField, { type: e.target.value as FieldType })}
                                                className="mt-1 w-full px-3 py-3 text-[15px] rounded-lg border border-slate-700 bg-slate-900 text-slate-100 outline-none focus:border-blue-400 focus:ring-1 focus:ring-blue-500/40 transition-colors"
                                            >
                                                {FIELD_TYPE_OPTIONS.map(opt => (
                                                    <option key={opt.value} value={opt.value}>{opt.label}</option>
                                                ))}
                                            </select>
                                        </div>
                                        <div>
                                            <label className="text-[15px] text-slate-300">Label</label>
                                            <input value={currentField.label} onChange={e => updateField(activeField, { label: e.target.value })} className="mt-1 w-full px-3 py-3 text-[15px] rounded-lg border border-slate-700 bg-slate-900 text-slate-100 outline-none focus:border-blue-400 focus:ring-1 focus:ring-blue-500/40 transition-colors" />
                                        </div>
                                        {!isStructural(currentField.type) && (
                                            <>
                                                <div>
                                                    <label className="text-[15px] text-slate-300">Placeholder</label>
                                                    <input value={currentField.placeholder} onChange={e => updateField(activeField, { placeholder: e.target.value })} className="mt-1 w-full px-3 py-3 text-[15px] rounded-lg border border-slate-700 bg-slate-900 text-slate-100 outline-none focus:border-blue-400 focus:ring-1 focus:ring-blue-500/40 transition-colors" />
                                                </div>
                                                <div>
                                                    <label className="text-[15px] text-slate-300">Help Text</label>
                                                    <textarea rows={2} value={currentField.description} onChange={e => updateField(activeField, { description: e.target.value })} className="mt-1 w-full px-3 py-3 text-[15px] rounded-lg border border-slate-700 bg-slate-900 text-slate-100 resize-none outline-none focus:border-blue-400 focus:ring-1 focus:ring-blue-500/40 transition-colors" />
                                                </div>
                                                <label className="flex items-center justify-between text-[15px] text-slate-300">
                                                    Required
                                                    <input type="checkbox" checked={currentField.required} onChange={e => updateField(activeField, { required: e.target.checked })} />
                                                </label>
                                            </>
                                        )}
                                    </div>
                                </section>

                                {isChoiceType(currentField.type) && (
                                    <section className="space-y-4 pt-6 border-t border-slate-700">
                                        <p className="text-[18px] font-semibold text-slate-100">Options</p>
                                        <div className="space-y-3">
                                            {currentField.options.map((opt, i) => (
                                                <div key={i} className="flex items-center gap-2">
                                                    <input
                                                        value={opt}
                                                        onChange={e => {
                                                            const next = [...currentField.options];
                                                            next[i] = e.target.value;
                                                            updateField(activeField, { options: next });
                                                        }}
                                                        className="flex-1 px-3 py-3 text-[15px] rounded-lg border border-slate-700 bg-slate-900 text-slate-100 outline-none focus:border-blue-400 focus:ring-1 focus:ring-blue-500/40 transition-colors"
                                                    />
                                                    <button type="button" onClick={() => updateField(activeField, { options: currentField.options.filter((_, idx) => idx !== i) })} className="px-2 py-2 text-xs rounded border border-rose-700 text-rose-300">X</button>
                                                </div>
                                            ))}
                                            <button type="button" onClick={() => updateField(activeField, { options: [...currentField.options, `Option ${currentField.options.length + 1}`] })} className="w-full px-3 py-2 text-[15px] rounded-lg text-slate-200 hover:bg-slate-800 transition-colors">+ Add Option</button>
                                        </div>
                                    </section>
                                )}

                                {!isStructural(currentField.type) && (
                                    <section className="space-y-4 pt-6 border-t border-slate-700">
                                        <p className="text-[18px] font-semibold text-slate-100">Validation</p>
                                        <div className="space-y-3">
                                            {isLengthType(currentField.type) && (
                                                <>
                                                    <input type="number" min={0} placeholder="Min length" value={currentField.validation.minLength ?? ''} onChange={e => updateField(activeField, { validation: { ...currentField.validation, minLength: e.target.value ? Number(e.target.value) : undefined } })} className="w-full px-3 py-3 text-[15px] rounded-lg border border-slate-700 bg-slate-900 text-slate-100 outline-none focus:border-blue-400 focus:ring-1 focus:ring-blue-500/40 transition-colors" />
                                                    <input type="number" min={0} placeholder="Max length" value={currentField.validation.maxLength ?? ''} onChange={e => updateField(activeField, { validation: { ...currentField.validation, maxLength: e.target.value ? Number(e.target.value) : undefined } })} className="w-full px-3 py-3 text-[15px] rounded-lg border border-slate-700 bg-slate-900 text-slate-100 outline-none focus:border-blue-400 focus:ring-1 focus:ring-blue-500/40 transition-colors" />
                                                </>
                                            )}
                                            {isRangeType(currentField.type) && (
                                                <>
                                                    <input placeholder="Min" value={currentField.validation.min || ''} onChange={e => updateField(activeField, { validation: { ...currentField.validation, min: e.target.value } })} className="w-full px-3 py-3 text-[15px] rounded-lg border border-slate-700 bg-slate-900 text-slate-100 outline-none focus:border-blue-400 focus:ring-1 focus:ring-blue-500/40 transition-colors" />
                                                    <input placeholder="Max" value={currentField.validation.max || ''} onChange={e => updateField(activeField, { validation: { ...currentField.validation, max: e.target.value } })} className="w-full px-3 py-3 text-[15px] rounded-lg border border-slate-700 bg-slate-900 text-slate-100 outline-none focus:border-blue-400 focus:ring-1 focus:ring-blue-500/40 transition-colors" />
                                                </>
                                            )}
                                        </div>
                                    </section>
                                )}

                                {!isStructural(currentField.type) && (
                                    <section className="pt-6 border-t border-slate-700">
                                        <details>
                                            <summary className="cursor-pointer text-[18px] font-semibold text-slate-100">Advanced</summary>
                                            <div className="mt-3 space-y-3">
                                                <input placeholder="Regex validation" value={currentField.validation.pattern || ''} onChange={e => updateField(activeField, { validation: { ...currentField.validation, pattern: e.target.value } })} className="w-full px-3 py-3 text-[15px] rounded-lg border border-slate-700 bg-slate-900 text-slate-100 outline-none focus:border-blue-400 focus:ring-1 focus:ring-blue-500/40 transition-colors" />
                                                <input placeholder="Custom error message" value={currentField.validation.customError || ''} onChange={e => updateField(activeField, { validation: { ...currentField.validation, customError: e.target.value } })} className="w-full px-3 py-3 text-[15px] rounded-lg border border-slate-700 bg-slate-900 text-slate-100 outline-none focus:border-blue-400 focus:ring-1 focus:ring-blue-500/40 transition-colors" />
                                            </div>
                                        </details>
                                    </section>
                                )}
                            </div>
                        )}

                        <div className="pt-4 border-t border-slate-700">
                            <button
                                type="button"
                                onClick={() => setPickerOpen(true)}
                                className="w-full py-2.5 rounded-xl text-[15px] font-medium border border-slate-600 text-slate-100 bg-slate-800/50 hover:bg-slate-700/70 transition-all duration-200"
                            >
                                + Add Block
                            </button>
                        </div>
                    </aside>
                </div>

                <div className="flex justify-end gap-2">
                    <button type="button" onClick={() => navigate('/hospital/forms')} className="px-4 py-2 rounded-lg text-[15px] text-slate-200 hover:bg-slate-800 transition-colors duration-200">Cancel</button>
                </div>
            </div>

            <TypePickerModal open={pickerOpen} onClose={() => setPickerOpen(false)} onSelect={addField} />

            {previewOpen && (
                <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm p-4" onClick={() => setPreviewOpen(false)}>
                    <div className="mx-auto h-full max-w-5xl rounded-2xl border border-slate-700 bg-slate-900 overflow-hidden flex flex-col" onClick={e => e.stopPropagation()}>
                        <div className="px-5 py-4 border-b border-slate-700 flex items-center justify-between">
                            <h3 className="text-lg font-semibold text-slate-100">Preview</h3>
                            <button type="button" onClick={() => setPreviewOpen(false)} className="px-3 py-1.5 rounded-md text-sm text-slate-300 hover:bg-slate-800">Close</button>
                        </div>
                        <div className="flex-1 overflow-auto p-8" style={{ backgroundColor: theme.backgroundColor }}>
                            <div className="mx-auto max-w-[760px] rounded-2xl p-6" style={{ backgroundColor: theme.cardColor }}>
                                <h2 className="text-[28px] font-bold text-slate-100">{name || 'Form Title'}</h2>
                                <p className="text-[15px] text-slate-300 mt-2">{description || 'Form Description'}</p>
                                <div className="mt-6 space-y-6">
                                    {fields.map(f => (
                                        <div key={f.id} className="space-y-2">
                                            <p className="text-[15px] font-semibold text-slate-100">{f.label}</p>
                                            {renderInputPreview(f)}
                                        </div>
                                    ))}
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            )}

        </div>
    );
};

export default CreateForm;
