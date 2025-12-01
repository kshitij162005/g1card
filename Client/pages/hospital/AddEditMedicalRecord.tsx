import { API_URL } from '../../config/api';
import React, { useEffect, useState, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import Card from '../../components/Card';
import { useAuth } from '../../contexts/AuthContext';

type FieldDef = { id?: string; label: string; key: string; type: string; required?: boolean; options?: string[] };

const AddEditMedicalRecord: React.FC = () => {
    const { patientId } = useParams<{ patientId: string }>();
    const navigate = useNavigate();
    const { user } = useAuth();

    const [templates, setTemplates] = useState<Array<any>>([]);
    const [loadingTemplates, setLoadingTemplates] = useState(false);
    const [selectedFormId, setSelectedFormId] = useState<string | 'custom' | ''>('');
    const [showFormFields, setShowFormFields] = useState(false);
    const [fields, setFields] = useState<FieldDef[]>([]);
    const [data, setData] = useState<Record<string, any>>({});
    const [attachments, setAttachments] = useState<any[]>([]);
    const [submitting, setSubmitting] = useState(false);
    const lastFormIdRef = useRef<string | 'custom' | ''>('');

    useEffect(() => { fetchTemplates(); }, []);

    // Only consider templates that are active for selection when adding records
    const activeTemplates = templates.filter((t: any) => t && (t.active === undefined || t.active === true));

    const fetchTemplates = async () => {
        if (!user) return;
        setLoadingTemplates(true);
        try {
            const resp = await fetch(`${API_URL}/hospitals/${user.id}/forms`);
            const d = await resp.json();
            if (!resp.ok) throw new Error(d.error || 'Failed');
            setTemplates(d.templates || []);
        } catch (err) { console.error('fetch templates', err); }
        finally { setLoadingTemplates(false); }
    };

    useEffect(() => {
        // If the currently selected form becomes inactive (server-side), clear selection
        if (selectedFormId && selectedFormId !== 'custom') {
            const stillActive = templates.find((t: any) => t._id === selectedFormId && (t.active === undefined || t.active === true));
            if (!stillActive) {
                setSelectedFormId('');
                // continue to run the reset logic below
            }
        }

        // Only reset if form selection actually changed
        if (selectedFormId === lastFormIdRef.current && selectedFormId !== '') {
            return; // Don't reset if same form is still selected
        }
        
        const previousFormId = lastFormIdRef.current;
        lastFormIdRef.current = selectedFormId;
        
        if (!selectedFormId) {
            setShowFormFields(false);
            setFields([]);
            setData({});
            setAttachments([]);
            return;
        }
        if (selectedFormId === 'custom') {
            setFields([
                { label: 'Notes', key: 'notes', type: 'textarea' },
            ]);
            // Only reset if switching to custom from another form
            if (previousFormId && previousFormId !== 'custom') {
                setData({ notes: '' });
            } else {
                setData(prev => prev.notes !== undefined ? prev : { notes: '' });
            }
            setAttachments([]);
            setShowFormFields(true);
            return;
        }
        const t = templates.find((x: any) => x._id === selectedFormId);
        if (!t) {
            setSelectedFormId('');
            setShowFormFields(false);
            setFields([]);
            setData({});
            return;
        }
        if (t) {
            const newFields = t.fields || [];
            setFields(newFields);
            // Only reset data if switching to a different form
            if (previousFormId && previousFormId !== selectedFormId) {
                const init: Record<string, any> = {};
                newFields.forEach((f: FieldDef) => { 
                    init[f.key] = ''; 
                });
                setData(init);
            } else {
                // Preserve existing data for fields that still exist, initialize new ones
                setData(prev => {
                    const init: Record<string, any> = {};
                    newFields.forEach((f: FieldDef) => { 
                        init[f.key] = prev[f.key] !== undefined ? prev[f.key] : ''; 
                    });
                    return init;
                });
            }
            setAttachments([]);
            setShowFormFields(true);
        }
    }, [selectedFormId, templates]);

    const handleChange = (key: string, value: any) => {
        setData(prev => ({ ...prev, [key]: value }));
    };

    const handleFile = (key: string, files: FileList | null) => {
        if (!files || files.length === 0) return;
        const arr = Array.from(files).map(f => ({ name: f.name, size: f.size, type: f.type }));
        setAttachments(prev => [...prev, ...arr]);
        handleChange(key, arr.map(a => a.name).join(','));
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!user) return alert('Not authenticated');
        setSubmitting(true);
        try {
            const payload = { formId: selectedFormId === 'custom' ? null : selectedFormId, data, attachments, createdBy: user.id };
            const resp = await fetch(`${API_URL}/hospitals/${user.id}/patients/${patientId}/records`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) });
            const d = await resp.json();
            if (!resp.ok) throw new Error(d.error || 'Failed to submit record');
            alert('Record submitted');
            navigate(`/hospital/patients/${patientId}`);
        } catch (err) { console.error('submit record', err); alert('Error submitting'); }
        finally { setSubmitting(false); }
    };

    if (loadingTemplates) {
        return <Card><p>Loading templates...</p></Card>;
    }

    if (!loadingTemplates && activeTemplates.length === 0) {
        return (
            <div className="space-y-6">
                <div className="flex justify-between items-center">
                    <h2 className="text-2xl font-bold text-slate-800 dark:text-slate-200">Add New Medical Record</h2>
                    <button onClick={() => navigate(-1)} className="px-4 py-2 bg-slate-200 dark:bg-slate-700 text-slate-800 dark:text-slate-200 text-sm rounded-lg hover:bg-slate-300 dark:hover:bg-slate-600">&larr; Back</button>
                </div>
                <Card>
                    <div className="space-y-4">
                        <p className="text-slate-700 dark:text-slate-300">There are no active form templates for this hospital. Please create or activate a form template first to submit structured records.</p>
                        <div className="flex gap-2">
                            <button onClick={() => navigate('/hospital/forms/create')} className="px-4 py-2 bg-brand-primary text-white rounded-lg hover:bg-brand-secondary transition-colors">Create Form Template</button>
                            <button onClick={() => navigate('/hospital/forms')} className="px-4 py-2 border border-slate-300 dark:border-slate-600 rounded-lg text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-700 transition-colors">Manage Forms</button>
                        </div>
                    </div>
                </Card>
            </div>
        );
    }

    const handleFormSelect = (formId: string) => {
        setSelectedFormId(formId);
    };

    return (
        <div className="space-y-6">
            <div className="flex justify-between items-center">
                <h2 className="text-2xl font-bold text-slate-800 dark:text-slate-200">Add New Medical Record</h2>
                <button onClick={() => navigate(-1)} className="px-4 py-2 bg-slate-200 dark:bg-slate-700 text-slate-800 dark:text-slate-200 text-sm rounded-lg hover:bg-slate-300 dark:hover:bg-slate-600 transition-colors">&larr; Back to Patient Record</button>
            </div>
            <Card>
                <form onSubmit={handleSubmit} className="space-y-6">
                    <div>
                        <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">Select Form Template *</label>
                        <select 
                            value={selectedFormId} 
                            onChange={e => handleFormSelect(e.target.value)} 
                            className="mt-1 block w-full px-4 py-2.5 border border-slate-300 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 focus:ring-2 focus:ring-brand-accent focus:border-brand-accent outline-none transition-all"
                        >
                                <option value="">-- Select a form template --</option>
                                <option value="custom">Custom / Blank Record</option>
                                {activeTemplates.map(t => (
                                    <option key={t._id} value={t._id}>
                                        {t.name} {t.description ? `- ${t.description}` : ''}
                                    </option>
                                ))}
                        </select>
                            {selectedFormId && activeTemplates.find((t: any) => t._id === selectedFormId) && (
                                <p className="mt-2 text-xs text-slate-500 dark:text-slate-400">
                                    {activeTemplates.find((t: any) => t._id === selectedFormId)?.description || 'No description available'}
                                </p>
                            )}
                    </div>

                    {showFormFields && (
                        <div className="space-y-4 pt-4 border-t border-slate-200 dark:border-slate-700">
                            <h3 className="text-lg font-semibold text-slate-800 dark:text-slate-200">Form Fields</h3>
                            {fields.map((f, idx) => (
                                <div key={`${f.key}-${idx}-${selectedFormId}`} className="space-y-2">
                                    <label className="block text-sm font-medium text-slate-700 dark:text-slate-300">
                                        {f.label}
                                        {f.required && <span className="text-rose-500 ml-1">*</span>}
                                    </label>
                                    {f.type === 'text' && (
                                        <input 
                                            value={data[f.key] || ''} 
                                            onChange={e => handleChange(f.key, e.target.value)} 
                                            required={f.required}
                                            className="mt-1 block w-full px-4 py-2.5 border border-slate-300 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 placeholder:text-slate-400 dark:placeholder:text-slate-500 focus:ring-2 focus:ring-brand-accent focus:border-brand-accent outline-none transition-all" 
                                            placeholder={`Enter ${f.label.toLowerCase()}`}
                                        />
                                    )}
                                    {f.type === 'number' && (
                                        <input 
                                            type="number" 
                                            value={data[f.key] || ''} 
                                            onChange={e => handleChange(f.key, e.target.value)} 
                                            required={f.required}
                                            className="mt-1 block w-full px-4 py-2.5 border border-slate-300 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 placeholder:text-slate-400 dark:placeholder:text-slate-500 focus:ring-2 focus:ring-brand-accent focus:border-brand-accent outline-none transition-all" 
                                            placeholder={`Enter ${f.label.toLowerCase()}`}
                                        />
                                    )}
                                    {f.type === 'date' && (
                                        <input 
                                            type="date" 
                                            value={data[f.key] || ''} 
                                            onChange={e => handleChange(f.key, e.target.value)} 
                                            required={f.required}
                                            className="mt-1 block w-full px-4 py-2.5 border border-slate-300 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 focus:ring-2 focus:ring-brand-accent focus:border-brand-accent outline-none transition-all" 
                                        />
                                    )}
                                    {f.type === 'textarea' && (
                                        <textarea 
                                            value={data[f.key] || ''} 
                                            onChange={e => handleChange(f.key, e.target.value)} 
                                            required={f.required}
                                            rows={4}
                                            className="mt-1 block w-full px-4 py-2.5 border border-slate-300 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 placeholder:text-slate-400 dark:placeholder:text-slate-500 focus:ring-2 focus:ring-brand-accent focus:border-brand-accent outline-none transition-all resize-none" 
                                            placeholder={`Enter ${f.label.toLowerCase()}`}
                                        />
                                    )}
                                    {f.type === 'select' && (
                                        <select 
                                            value={data[f.key] || ''} 
                                            onChange={e => handleChange(f.key, e.target.value)} 
                                            required={f.required}
                                            className="mt-1 block w-full px-4 py-2.5 border border-slate-300 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 focus:ring-2 focus:ring-brand-accent focus:border-brand-accent outline-none transition-all"
                                        >
                                            <option value="">-- Select an option --</option>
                                            {(f.options || []).map(opt => (
                                                <option key={opt} value={opt}>{opt}</option>
                                            ))}
                                        </select>
                                    )}
                                    {f.type === 'file' && (
                                        <div className="mt-1">
                                            <input 
                                                type="file" 
                                                multiple 
                                                onChange={e => handleFile(f.key, e.target.files)} 
                                                className="block w-full text-sm text-slate-500 dark:text-slate-400 file:mr-4 file:py-2 file:px-4 file:rounded-lg file:border-0 file:text-sm file:font-semibold file:bg-brand-primary file:text-white hover:file:bg-brand-secondary file:cursor-pointer" 
                                            />
                                            {attachments.length > 0 && (
                                                <p className="mt-2 text-xs text-slate-500 dark:text-slate-400">
                                                    {attachments.length} file(s) selected
                                                </p>
                                            )}
                                        </div>
                                    )}
                                </div>
                            ))}
                        </div>
                    )}

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
                            disabled={submitting || !selectedFormId || !showFormFields} 
                            className="px-6 py-2.5 bg-brand-primary text-white rounded-lg hover:bg-brand-secondary disabled:opacity-50 disabled:cursor-not-allowed transition-colors shadow-sm hover:shadow-md"
                        >
                            {submitting ? 'Submitting...' : 'Submit Record'}
                        </button>
                    </div>
                </form>
            </Card>
        </div>
    );
};

export default AddEditMedicalRecord;