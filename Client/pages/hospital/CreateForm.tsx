import { API_URL } from '../../config/api';
import React, { useEffect, useMemo, useRef, useState } from 'react';
import { SettingRow, Switch } from '../../components/settings/Settings';
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

// Icons and one-line hints for every question type, used by the palette, outline and editor
const TYPE_META: Record<FieldType, { label: string; hint: string; icon: React.ReactNode }> = {
    text: { label: 'Short answer', hint: 'One line of text', icon: <path d="M4 7h16M4 12h10" /> },
    textarea: { label: 'Paragraph', hint: 'Longer notes', icon: <path d="M4 6h16M4 10h16M4 14h16M4 18h10" /> },
    number: { label: 'Number', hint: 'Readings like pulse or dose', icon: <path d="M9 4 7 20M17 4l-2 16M4 9h16M3 15h16" /> },
    email: { label: 'Email', hint: 'Checked for a valid address', icon: <><rect x="3" y="5" width="18" height="14" rx="2" /><path d="m3 7 9 6 9-6" /></> },
    tel: { label: 'Phone', hint: 'Phone number', icon: <path d="M22 16.9v3a2 2 0 0 1-2.2 2 19.8 19.8 0 0 1-8.6-3.1 19.5 19.5 0 0 1-6-6A19.8 19.8 0 0 1 2.1 4.2 2 2 0 0 1 4.1 2h3a2 2 0 0 1 2 1.7c.1.9.4 1.8.7 2.7a2 2 0 0 1-.5 2.1L8 9.8a16 16 0 0 0 6 6l1.3-1.3a2 2 0 0 1 2.1-.4c.9.3 1.8.6 2.7.7a2 2 0 0 1 1.7 2z" /> },
    date: { label: 'Date', hint: 'Calendar picker', icon: <><rect x="3" y="5" width="18" height="16" rx="2" /><path d="M16 3v4M8 3v4M3 11h18" /></> },
    time: { label: 'Time', hint: 'Clock time', icon: <><circle cx="12" cy="12" r="9" /><path d="M12 7v5l3 2" /></> },
    select: { label: 'Dropdown', hint: 'Pick one from a list', icon: <><rect x="3" y="6" width="18" height="12" rx="2" /><path d="m9 11 3 3 3-3" /></> },
    radio: { label: 'Single choice', hint: 'Pick one, all options visible', icon: <><circle cx="12" cy="12" r="9" /><circle cx="12" cy="12" r="3.5" /></> },
    checkbox: { label: 'Multiple choice', hint: 'Tick any that apply', icon: <><rect x="4" y="4" width="16" height="16" rx="3" /><path d="m8.5 12 2.5 2.5 4.5-5" /></> },
    file: { label: 'File upload', hint: 'Reports, scans, photos', icon: <><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" /><path d="M17 8l-5-5-5 5M12 3v12" /></> },
    section: { label: 'Section heading', hint: 'Group related questions', icon: <path d="M6 4v16M18 4v16M6 12h12" /> },
    pageBreak: { label: 'Page break', hint: 'Split into steps', icon: <path d="M3 12h3m4 0h4m4 0h3M8 4v4h8V4M8 20v-4h8v4" /> },
};

const TypeIcon: React.FC<{ type: FieldType; size?: number }> = ({ type, size = 16 }) => (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden>{TYPE_META[type].icon}</svg>
);

const FILE_TYPES = ['PDF', 'Image', 'Word', 'Excel', 'DICOM'];

// Quick starting points so a new form isn't a blank page
const STARTERS: Array<{ name: string; description: string; fields: Array<[FieldType, string, Partial<FieldItem>?]> }> = [
    { name: 'Visit notes', description: 'Complaint, findings and plan for an outpatient visit.', fields: [
        ['textarea', 'Chief complaint', { required: true, placeholder: 'What brought the patient in today?' }],
        ['textarea', 'Examination findings'],
        ['text', 'Diagnosis', { required: true }],
        ['textarea', 'Plan and advice'],
        ['date', 'Follow-up date'],
    ] },
    { name: 'Prescription', description: 'Medicines with dosage and duration.', fields: [
        ['text', 'Diagnosis', { required: true }],
        ['textarea', 'Medicines', { required: true, placeholder: 'One per line: name, strength, dose, frequency, days' }],
        ['textarea', 'Instructions', { placeholder: 'e.g. After food, avoid driving' }],
        ['date', 'Review on'],
    ] },
    { name: 'Vitals', description: 'Quick observations taken at triage.', fields: [
        ['text', 'Blood pressure', { placeholder: '120/80', description: 'mmHg' }],
        ['number', 'Pulse', { description: 'beats per minute' }],
        ['number', 'Temperature', { description: '°F' }],
        ['number', 'SpO₂', { description: '%' }],
        ['radio', 'Pain level', { options: ['None', 'Mild', 'Moderate', 'Severe'] }],
    ] },
];

/** The form exactly as staff will fill it in, with working inputs */
const LiveField: React.FC<{ field: FieldItem; index: number; active: boolean; onSelect: () => void }> = ({ field, index, active, onSelect }) => {
    if (field.type === 'pageBreak') {
        return <div className={`fb-pv-break ${active ? 'is-active' : ''}`} onClick={onSelect}><span>{field.label && field.label !== 'Page Break' ? field.label : 'Next page'}</span></div>;
    }
    if (field.type === 'section') {
        return (
            <div className={`fb-pv-section ${active ? 'is-active' : ''}`} onClick={onSelect}>
                <h3>{field.label || 'Untitled section'}</h3>
                {field.description && <p>{field.description}</p>}
            </div>
        );
    }
    const id = `pv-${field.id}`;
    const options = field.options.filter(o => o.trim());
    const v = field.validation;
    let control: React.ReactNode;
    switch (field.type) {
        case 'textarea':
            control = <textarea id={id} rows={3} placeholder={field.placeholder} minLength={v.minLength} maxLength={v.maxLength} />;
            break;
        case 'select':
            control = (
                <select id={id} defaultValue="">
                    <option value="" disabled>{field.placeholder || 'Choose…'}</option>
                    {options.map(o => <option key={o}>{o}</option>)}
                </select>
            );
            break;
        case 'radio':
        case 'checkbox':
            control = (
                <div className="fb-pv-choices" role={field.type === 'radio' ? 'radiogroup' : 'group'}>
                    {options.length ? options.map(o => (
                        <label key={o}><input type={field.type} name={id} /> <span>{o}</span></label>
                    )) : <span className="fb-pv-empty">Add options to see them here</span>}
                </div>
            );
            break;
        case 'file':
            control = (
                <div className="fb-pv-file">
                    <TypeIcon type="file" size={18} />
                    <span>{field.placeholder || 'Drop files or click to upload'}</span>
                    <small>{field.fileSettings.allowedTypes.join(', ')} · up to {field.fileSettings.maxFileSizeMB} MB{field.fileSettings.maxFiles > 1 ? ` · ${field.fileSettings.maxFiles} files` : ''}</small>
                </div>
            );
            break;
        default:
            control = <input id={id} type={field.type} placeholder={field.placeholder} min={v.min || undefined} max={v.max || undefined} minLength={v.minLength} maxLength={v.maxLength} />;
    }
    return (
        <div className={`fb-pv-field ${active ? 'is-active' : ''}`} onClick={onSelect}>
            <label htmlFor={id}><span className="fb-pv-num">{index}.</span> {field.label || 'Untitled question'}{field.required && <em aria-label="required">*</em>}</label>
            {field.description && <p className="fb-pv-help">{field.description}</p>}
            {control}
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
    const [theme] = useState<ThemeSettings>(DEFAULT_THEME);
    const [draftHydrated, setDraftHydrated] = useState(false);
    // True once the form being edited/cloned has loaded, so "unsaved changes" compares against it
    const [baselineReady, setBaselineReady] = useState(false);

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
                setBaselineReady(true);
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
            notify(err instanceof Error && err.message ? err.message : 'Unable to save form');
        }
    };

    // ---------- Builder state that only affects the UI ----------
    // Field ids are generated on load, so they're left out when checking for unsaved changes
    const snapshot = JSON.stringify({ name, description, fields: fields.map(({ id: _id, ...rest }) => rest) });
    const [savedSnapshot, setSavedSnapshot] = useState<string | null>(null);
    const [saving, setSaving] = useState<null | 'draft' | 'publish'>(null);
    const [paletteOpen, setPaletteOpen] = useState(false);
    const [previewWidth, setPreviewWidth] = useState<'desktop' | 'phone'>('desktop');
    const optionRefs = useRef<Array<HTMLInputElement | null>>([]);
    const focusOption = useRef<number | null>(null);

    // Baseline for "unsaved changes": what was loaded (or the empty form) once loading settles
    useEffect(() => {
        if (loading || savedSnapshot !== null) return;
        const ready = isCreateFresh ? draftHydrated : baselineReady;
        // A new form's baseline is the empty form, so a restored local draft counts as unsaved
        if (ready) setSavedSnapshot(isCreateFresh ? JSON.stringify({ name: '', description: '', fields: [] }) : snapshot);
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [loading, draftHydrated, baselineReady]);
    const dirty = savedSnapshot !== null && snapshot !== savedSnapshot;

    useEffect(() => {
        if (!dirty) return;
        const warn = (e: BeforeUnloadEvent) => { e.preventDefault(); e.returnValue = ''; };
        window.addEventListener('beforeunload', warn);
        return () => window.removeEventListener('beforeunload', warn);
    }, [dirty]);

    // What still blocks saving, in plain words, each linked to the question to fix
    const issues = useMemo(() => {
        const list: Array<{ text: string; index: number }> = [];
        if (!name.trim()) list.push({ text: 'Give the form a title', index: -1 });
        if (fields.length === 0) list.push({ text: 'Add at least one question', index: -1 });
        fields.forEach((f, i) => {
            if (f.type !== 'pageBreak' && !f.label.trim()) list.push({ text: `Question ${i + 1} needs a label`, index: i });
            if (isChoiceType(f.type) && f.options.filter(o => o.trim()).length === 0) list.push({ text: `“${f.label || `Question ${i + 1}`}” needs at least one option`, index: i });
        });
        return list;
    }, [name, fields]);

    const runSave = async (publish: boolean) => {
        setSaving(publish ? 'publish' : 'draft');
        try {
            await saveForm(publish);
        } finally {
            setSaving(null);
        }
    };

    useEffect(() => {
        const onKey = (e: KeyboardEvent) => {
            if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 's') {
                e.preventDefault();
                if (canSave && !saving) runSave(false);
                else if (!canSave) notify(issues[0]?.text || 'Finish the form first');
            }
        };
        window.addEventListener('keydown', onKey);
        return () => window.removeEventListener('keydown', onKey);
    });

    useEffect(() => {
        if (focusOption.current === null) return;
        optionRefs.current[focusOption.current]?.focus();
        focusOption.current = null;
    });

    const leave = () => {
        if (dirty && !window.confirm('Leave without saving? Your changes to this form will be lost.')) return;
        if (dirty && localDraftKey && isCreateFresh) localStorage.removeItem(localDraftKey);
        navigate('/hospital/forms');
    };

    const applyStarter = (starter: typeof STARTERS[number]) => {
        const keys: string[] = [];
        const built = starter.fields.map(([type, label, extra], i) => {
            const f = createField(type, i, keys);
            const key = ensureUniqueKey(slugify(label), keys);
            keys.push(key);
            return { ...f, id: `${f.id}_${i}`, label, key, ...extra, options: extra?.options || f.options };
        });
        if (!name.trim()) setName(starter.name);
        if (!description.trim()) setDescription(starter.description);
        setFields(built);
        setActiveField(0);
    };

    const addOf = (type: FieldType) => {
        addField(type);
        setPaletteOpen(false);
    };

    const setOptions = (opts: string[]) => updateField(activeField, { options: opts });
    const requiredCount = fields.filter(f => f.required).length;
    const questionCount = fields.filter(f => !isStructural(f.type)).length;
    let questionNumber = 0;

    const palette = (
        <div className="fb-palette" role="menu">
            {FIELD_PICKER_GROUPS.map(group => (
                <div key={group.title} className="fb-palette-group">
                    <p>{group.title === 'Basic Fields' ? 'Answers' : group.title}</p>
                    <div>
                        {group.items.map(item => (
                            <button key={item.type} type="button" role="menuitem" onClick={() => addOf(item.type)}>
                                <TypeIcon type={item.type} />
                                <span>{TYPE_META[item.type].label}<small>{TYPE_META[item.type].hint}</small></span>
                            </button>
                        ))}
                    </div>
                </div>
            ))}
        </div>
    );

    const preview = (
        <div className={`fb-pv ${previewWidth === 'phone' ? 'is-phone' : ''}`}>
            <div className="fb-pv-page">
                <h2>{name || 'Untitled form'}</h2>
                {description && <p className="fb-pv-desc">{description}</p>}
                {fields.length === 0 ? (
                    <p className="fb-pv-empty">Questions you add will appear here, exactly as staff will fill them in.</p>
                ) : (
                    <form className="fb-pv-fields" onSubmit={e => e.preventDefault()}>
                        {fields.map((f, i) => {
                            if (!isStructural(f.type)) questionNumber++;
                            return <LiveField key={f.id} field={f} index={questionNumber} active={i === activeField} onSelect={() => setActiveField(i)} />;
                        })}
                        <button type="button" className="fb-pv-submit" disabled>Save record</button>
                    </form>
                )}
            </div>
        </div>
    );

    if (loading) {
        return <div className="fb-loading"><div className="at-skeleton">{[0, 1, 2].map(n => <div key={n} style={{ height: 90 }} />)}</div></div>;
    }

    return (
        <div className="fb">
            <header className="fb-bar">
                <button type="button" className="fb-back" onClick={leave} aria-label="Back to forms">
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden><path d="m15 18-6-6 6-6" /></svg>
                    Forms
                </button>
                <div className="fb-bar-title">
                    <p>{isEditing ? 'Editing form' : cloneId ? 'New form from a copy' : 'New form'}</p>
                    <span>
                        {questionCount} question{questionCount === 1 ? '' : 's'}{requiredCount ? ` · ${requiredCount} required` : ''}
                        {' · '}
                        {saving ? 'Saving…' : dirty ? (isCreateFresh ? 'Draft kept on this device' : 'Unsaved changes') : 'All changes saved'}
                    </span>
                </div>
                <div className="fb-bar-actions">
                    <button type="button" className="nt-btn" onClick={() => runSave(false)} disabled={!canSave || Boolean(saving)} title="Save as draft (⌘/Ctrl + S)">
                        {saving === 'draft' ? 'Saving…' : 'Save draft'}
                    </button>
                    <button type="button" className="nt-btn nt-btn--primary" onClick={() => runSave(true)} disabled={!canSave || Boolean(saving)} title={canSave ? 'Make this form available when adding records' : issues[0]?.text}>
                        {saving === 'publish' ? 'Publishing…' : isEditing ? 'Save & publish' : 'Publish'}
                    </button>
                </div>
            </header>

            {issues.length > 0 && fields.length > 0 && (
                <div className="fb-issues" role="status">
                    <b>Before you can save:</b>
                    {issues.slice(0, 4).map((issue, i) => (
                        <button key={i} type="button" onClick={() => issue.index >= 0 ? setActiveField(issue.index) : document.getElementById('fb-title')?.focus()}>{issue.text}</button>
                    ))}
                    {issues.length > 4 && <span>+{issues.length - 4} more</span>}
                </div>
            )}

            <div className="fb-grid">
                {/* Outline: every question in order, drag to reorder */}
                <aside className="fb-outline">
                    <div className="fb-meta">
                        <input id="fb-title" className="fb-title-input" value={name} onChange={e => setName(e.target.value)} placeholder="Form title" aria-label="Form title" />
                        <textarea className="fb-desc-input" value={description} onChange={e => setDescription(e.target.value)} placeholder="What is this form for? (shown to staff)" rows={2} aria-label="Form description" />
                    </div>
                    <p className="fb-label">Questions</p>
                    {fields.length > 0 && (
                        <ol className="fb-list">
                            {fields.map((f, idx) => {
                                const bad = issues.some(x => x.index === idx);
                                return (
                                    <li
                                        key={f.id}
                                        draggable
                                        onDragStart={() => setDragFrom(idx)}
                                        onDragOver={e => e.preventDefault()}
                                        onDrop={() => handleDrop(idx)}
                                        onDragEnd={() => setDragFrom(null)}
                                        className={`${idx === activeField ? 'is-active' : ''} ${dragFrom === idx ? 'is-dragging' : ''} ${f.type === 'section' ? 'is-section' : ''}`}
                                    >
                                        <button type="button" onClick={() => setActiveField(idx)}>
                                            <span className="fb-grip" aria-hidden>⋮⋮</span>
                                            <TypeIcon type={f.type} />
                                            <span className="fb-list-text">{f.type === 'pageBreak' ? 'Page break' : (f.label || 'Untitled')}</span>
                                            {f.required && <em title="Required">*</em>}
                                            {bad && <i className="fb-bad" title="Needs attention" />}
                                        </button>
                                    </li>
                                );
                            })}
                        </ol>
                    )}
                    <div className="fb-add">
                        <button type="button" className={`fb-add-btn ${paletteOpen ? 'is-open' : ''}`} onClick={() => setPaletteOpen(v => !v)} aria-expanded={paletteOpen}>
                            <span aria-hidden>+</span> Add question
                        </button>
                        {paletteOpen && palette}
                    </div>
                </aside>

                {/* Editor for the selected question */}
                <main className="fb-editor">
                    {fields.length === 0 ? (
                        <div className="fb-start">
                            <h2>Start your form</h2>
                            <p>Pick a starting point or add questions one by one. You can change everything later.</p>
                            <div className="fb-starters">
                                {STARTERS.map(s => (
                                    <button key={s.name} type="button" onClick={() => applyStarter(s)}>
                                        <b>{s.name}</b>
                                        <span>{s.description}</span>
                                        <small>{s.fields.length} questions</small>
                                    </button>
                                ))}
                            </div>
                            <p className="fb-label">Or add a single question</p>
                            {palette}
                        </div>
                    ) : currentField ? (
                        <div className="fb-card" key={currentField.id}>
                            <div className="fb-card-head">
                                <span className="fb-card-step">{isStructural(currentField.type) ? TYPE_META[currentField.type].label : `Question ${fields.slice(0, activeField + 1).filter(f => !isStructural(f.type)).length} of ${questionCount}`}</span>
                                <div className="fb-tools">
                                    <button type="button" onClick={() => moveField(activeField, 'up')} disabled={activeField === 0} title="Move up" aria-label="Move up">
                                        <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden><path d="m18 15-6-6-6 6" /></svg>
                                    </button>
                                    <button type="button" onClick={() => moveField(activeField, 'down')} disabled={activeField === fields.length - 1} title="Move down" aria-label="Move down">
                                        <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden><path d="m6 9 6 6 6-6" /></svg>
                                    </button>
                                    <button type="button" onClick={() => duplicateField(activeField)} title="Duplicate" aria-label="Duplicate">
                                        <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden><rect x="9" y="9" width="12" height="12" rx="2" /><path d="M5 15H4a1 1 0 0 1-1-1V4a1 1 0 0 1 1-1h10a1 1 0 0 1 1 1v1" /></svg>
                                    </button>
                                    <button type="button" className="is-danger" onClick={() => removeField(activeField)} disabled={fields.length <= 1} title={fields.length <= 1 ? 'A form needs at least one question' : 'Delete'} aria-label="Delete question">
                                        <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden><path d="M3 6h18M8 6V4h8v2M19 6l-1 14H6L5 6" /></svg>
                                    </button>
                                </div>
                            </div>

                            <div className="fb-types" role="radiogroup" aria-label="Question type">
                                {FIELD_TYPE_OPTIONS.map(opt => (
                                    <button key={opt.value} type="button" role="radio" aria-checked={currentField.type === opt.value} className={currentField.type === opt.value ? 'is-on' : ''} onClick={() => updateField(activeField, { type: opt.value })} title={TYPE_META[opt.value].hint}>
                                        <TypeIcon type={opt.value} size={15} /> {TYPE_META[opt.value].label}
                                    </button>
                                ))}
                            </div>

                            {currentField.type !== 'pageBreak' && (
                                <div className="st-field">
                                    <label htmlFor="fb-q-label">{currentField.type === 'section' ? 'Heading' : 'Question'}</label>
                                    <input id="fb-q-label" className="st-input fb-q-label" value={currentField.label} onChange={e => updateField(activeField, { label: e.target.value })} placeholder={currentField.type === 'section' ? 'e.g. Examination' : 'e.g. Chief complaint'} autoFocus />
                                </div>
                            )}
                            {currentField.type === 'pageBreak' && (
                                <p className="fb-hint">Everything after this point appears on the next step when staff fill the form.</p>
                            )}

                            {currentField.type !== 'pageBreak' && (
                                <div className="st-field">
                                    <label htmlFor="fb-q-help">{currentField.type === 'section' ? 'Description' : 'Help text'} <small>optional</small></label>
                                    <input id="fb-q-help" className="st-input" value={currentField.description} onChange={e => updateField(activeField, { description: e.target.value })} placeholder={currentField.type === 'section' ? 'A line about this group of questions' : 'Shown under the question, e.g. units or an example'} />
                                </div>
                            )}

                            {!isStructural(currentField.type) && !isChoiceType(currentField.type) && (
                                <div className="st-field">
                                    <label htmlFor="fb-q-ph">Placeholder <small>optional</small></label>
                                    <input id="fb-q-ph" className="st-input" value={currentField.placeholder} onChange={e => updateField(activeField, { placeholder: e.target.value })} placeholder="Faint example text inside the box" />
                                </div>
                            )}

                            {isChoiceType(currentField.type) && (
                                <div className="st-field">
                                    <label>Options <small>press Enter for the next one</small></label>
                                    <div className="fb-options">
                                        {currentField.options.map((opt, i) => (
                                            <div key={i} className="fb-option">
                                                <span className="fb-option-mark" aria-hidden>{currentField.type === 'radio' ? '○' : currentField.type === 'checkbox' ? '☐' : `${i + 1}.`}</span>
                                                <input
                                                    ref={el => { optionRefs.current[i] = el; }}
                                                    className="st-input"
                                                    value={opt}
                                                    aria-label={`Option ${i + 1}`}
                                                    onChange={e => { const next = [...currentField.options]; next[i] = e.target.value; setOptions(next); }}
                                                    onKeyDown={e => {
                                                        if (e.key === 'Enter') {
                                                            e.preventDefault();
                                                            const next = [...currentField.options];
                                                            next.splice(i + 1, 0, '');
                                                            focusOption.current = i + 1;
                                                            setOptions(next);
                                                        } else if (e.key === 'Backspace' && !opt && currentField.options.length > 1) {
                                                            e.preventDefault();
                                                            focusOption.current = Math.max(0, i - 1);
                                                            setOptions(currentField.options.filter((_, j) => j !== i));
                                                        }
                                                    }}
                                                />
                                                <button type="button" onClick={() => setOptions(currentField.options.filter((_, j) => j !== i))} disabled={currentField.options.length <= 1} aria-label={`Remove option ${i + 1}`}>×</button>
                                            </div>
                                        ))}
                                        <button type="button" className="fb-option-add" onClick={() => { focusOption.current = currentField.options.length; setOptions([...currentField.options, '']); }}>+ Add option</button>
                                    </div>
                                </div>
                            )}

                            {currentField.type === 'file' && (
                                <div className="st-field">
                                    <label>Accepted files</label>
                                    <div className="fb-chips">
                                        {FILE_TYPES.map(t => {
                                            const on = currentField.fileSettings.allowedTypes.includes(t);
                                            return (
                                                <button key={t} type="button" className={on ? 'is-on' : ''} aria-pressed={on} onClick={() => {
                                                    const list = on ? currentField.fileSettings.allowedTypes.filter(x => x !== t) : [...currentField.fileSettings.allowedTypes, t];
                                                    if (list.length) updateField(activeField, { fileSettings: { ...currentField.fileSettings, allowedTypes: list } });
                                                }}>{t}</button>
                                            );
                                        })}
                                    </div>
                                    <div className="fb-pair">
                                        <div className="hd-suffix"><input className="st-input" inputMode="numeric" aria-label="Max size per file" value={currentField.fileSettings.maxFileSizeMB} onChange={e => updateField(activeField, { fileSettings: { ...currentField.fileSettings, maxFileSizeMB: Math.max(1, Number(e.target.value.replace(/\D/g, '')) || 1) } })} /><span>MB max</span></div>
                                        <div className="hd-suffix"><input className="st-input" inputMode="numeric" aria-label="Max number of files" value={currentField.fileSettings.maxFiles} onChange={e => updateField(activeField, { fileSettings: { ...currentField.fileSettings, maxFiles: Math.max(1, Number(e.target.value.replace(/\D/g, '')) || 1) } })} /><span>files</span></div>
                                    </div>
                                </div>
                            )}

                            {!isStructural(currentField.type) && (
                                <SettingRow title="Required" description="Staff can’t save the record until this is answered.">
                                    <Switch label="Required" checked={currentField.required} onChange={v => updateField(activeField, { required: v })} />
                                </SettingRow>
                            )}

                            {!isStructural(currentField.type) && (isLengthType(currentField.type) || isRangeType(currentField.type)) && (
                                <details className="fb-more">
                                    <summary>Limits and validation</summary>
                                    <div className="fb-pair">
                                        {isLengthType(currentField.type) ? (
                                            <>
                                                <div className="st-field"><label htmlFor="fb-minl">Min characters</label><input id="fb-minl" className="st-input" type="number" min={0} value={currentField.validation.minLength ?? ''} onChange={e => updateField(activeField, { validation: { ...currentField.validation, minLength: e.target.value ? Number(e.target.value) : undefined } })} /></div>
                                                <div className="st-field"><label htmlFor="fb-maxl">Max characters</label><input id="fb-maxl" className="st-input" type="number" min={0} value={currentField.validation.maxLength ?? ''} onChange={e => updateField(activeField, { validation: { ...currentField.validation, maxLength: e.target.value ? Number(e.target.value) : undefined } })} /></div>
                                            </>
                                        ) : (
                                            <>
                                                <div className="st-field"><label htmlFor="fb-min">Lowest allowed</label><input id="fb-min" className="st-input" type={currentField.type === 'number' ? 'number' : currentField.type} value={currentField.validation.min || ''} onChange={e => updateField(activeField, { validation: { ...currentField.validation, min: e.target.value } })} /></div>
                                                <div className="st-field"><label htmlFor="fb-max">Highest allowed</label><input id="fb-max" className="st-input" type={currentField.type === 'number' ? 'number' : currentField.type} value={currentField.validation.max || ''} onChange={e => updateField(activeField, { validation: { ...currentField.validation, max: e.target.value } })} /></div>
                                            </>
                                        )}
                                    </div>
                                    {isLengthType(currentField.type) && (
                                        <div className="st-field"><label htmlFor="fb-rx">Pattern <small>regular expression, for advanced use</small></label><input id="fb-rx" className="st-input" value={currentField.validation.pattern || ''} onChange={e => updateField(activeField, { validation: { ...currentField.validation, pattern: e.target.value } })} placeholder="e.g. ^[A-Z]{2}[0-9]{4}$" /></div>
                                    )}
                                    <div className="st-field"><label htmlFor="fb-err">Message when the answer isn’t valid</label><input id="fb-err" className="st-input" value={currentField.validation.customError || ''} onChange={e => updateField(activeField, { validation: { ...currentField.validation, customError: e.target.value } })} placeholder="e.g. Enter a value between 30 and 45" /></div>
                                </details>
                            )}

                            {!isStructural(currentField.type) && <p className="fb-key">Stored as <code>{currentField.key || '—'}</code></p>}
                        </div>
                    ) : null}
                </main>

                {/* Live preview */}
                <section className="fb-preview" aria-label="Live preview">
                    <div className="fb-preview-head">
                        <p className="fb-label">Live preview</p>
                        <div className="hd-seg" role="radiogroup" aria-label="Preview width">
                            {(['desktop', 'phone'] as const).map(w => (
                                <button key={w} type="button" role="radio" aria-checked={previewWidth === w} className={previewWidth === w ? 'is-on' : ''} onClick={() => setPreviewWidth(w)}>{w === 'desktop' ? 'Desktop' : 'Phone'}</button>
                            ))}
                        </div>
                    </div>
                    {preview}
                </section>
            </div>
        </div>
    );
};

export default CreateForm;
