import React, { useEffect, useState } from 'react';
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
    const [selectedFormId, setSelectedFormId] = useState<string | 'custom'>('custom');
    const [fields, setFields] = useState<FieldDef[]>([]);
    const [data, setData] = useState<Record<string, any>>({});
    const [attachments, setAttachments] = useState<any[]>([]);
    const [submitting, setSubmitting] = useState(false);

    useEffect(() => { fetchTemplates(); }, []);

    const fetchTemplates = async () => {
        if (!user) return;
        setLoadingTemplates(true);
        try {
            const resp = await fetch(`http://localhost:8082/api/hospitals/${user.id}/forms`);
            const d = await resp.json();
            if (!resp.ok) throw new Error(d.error || 'Failed');
            setTemplates(d.templates || []);
        } catch (err) { console.error('fetch templates', err); }
        finally { setLoadingTemplates(false); }
    };

    useEffect(() => {
        if (selectedFormId === 'custom') {
            setFields([
                { label: 'Notes', key: 'notes', type: 'textarea' },
            ]);
            setData({});
            setAttachments([]);
            return;
        }
        const t = templates.find((x: any) => x._id === selectedFormId);
        if (t) {
            setFields(t.fields || []);
            const init: Record<string, any> = {};
            (t.fields || []).forEach((f: FieldDef) => { init[f.key] = ''; });
            setData(init);
            setAttachments([]);
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
            const resp = await fetch(`http://localhost:8082/api/hospitals/${user.id}/patients/${patientId}/records`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) });
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

    if (!loadingTemplates && templates.length === 0) {
        return (
            <div className="space-y-6">
                <div className="flex justify-between items-center">
                    <h2 className="text-2xl font-bold text-slate-800 dark:text-slate-200">Add New Medical Record</h2>
                    <button onClick={() => navigate(-1)} className="px-4 py-2 bg-slate-200 text-slate-800 text-sm rounded-lg">&larr; Back</button>
                </div>
                <Card>
                    <div className="space-y-4">
                        <p className="text-slate-700 dark:text-slate-300">There are no form templates created for this hospital. Please create a form template first to submit structured records.</p>
                        <div className="flex gap-2">
                            <button onClick={() => navigate('/hospital/forms/create')} className="px-4 py-2 bg-brand-primary text-white rounded">Create Form Template</button>
                            <button onClick={() => navigate('/hospital/forms')} className="px-4 py-2 border rounded">Manage Forms</button>
                        </div>
                    </div>
                </Card>
            </div>
        );
    }

    return (
        <div className="space-y-6">
            <div className="flex justify-between items-center">
                 <h2 className="text-2xl font-bold text-slate-800 dark:text-slate-200">Add New Medical Record ({patientId})</h2>
                <button onClick={() => navigate(-1)} className="px-4 py-2 bg-slate-200 text-slate-800 text-sm rounded-lg">&larr; Back to Patient Record</button>
            </div>
            <Card>
                <form onSubmit={handleSubmit} className="space-y-6">
                    <div>
                        <label className="block text-sm font-medium text-slate-700 dark:text-slate-300">Form Template</label>
                        <select value={selectedFormId} onChange={e => setSelectedFormId(e.target.value as any)} className="mt-1 block w-full px-3 py-2 border rounded">
                            <option value="custom">Custom / Blank</option>
                            {templates.map(t => <option key={t._id} value={t._id}>{t.name}</option>)}
                        </select>
                    </div>

                    <div className="space-y-4">
                        {fields.map((f, idx) => (
                            <div key={f.key || idx}>
                                <label className="block text-sm font-medium text-slate-700 dark:text-slate-300">{f.label}{f.required ? ' *' : ''}</label>
                                {f.type === 'text' && <input value={data[f.key] || ''} onChange={e => handleChange(f.key, e.target.value)} className="mt-1 block w-full px-3 py-2 border rounded" />}
                                {f.type === 'number' && <input type="number" value={data[f.key] || ''} onChange={e => handleChange(f.key, e.target.value)} className="mt-1 block w-full px-3 py-2 border rounded" />}
                                {f.type === 'date' && <input type="date" value={data[f.key] || ''} onChange={e => handleChange(f.key, e.target.value)} className="mt-1 block w-full px-3 py-2 border rounded" />}
                                {f.type === 'textarea' && <textarea value={data[f.key] || ''} onChange={e => handleChange(f.key, e.target.value)} className="mt-1 block w-full px-3 py-2 border rounded" />}
                                {f.type === 'select' && (
                                    <select value={data[f.key] || ''} onChange={e => handleChange(f.key, e.target.value)} className="mt-1 block w-full px-3 py-2 border rounded">
                                        <option value="">-- select --</option>
                                        {(f.options || []).map(opt => <option key={opt} value={opt}>{opt}</option>)}
                                    </select>
                                )}
                                {f.type === 'file' && (
                                    <div className="mt-1">
                                        <input type="file" multiple onChange={e => handleFile(f.key, e.target.files)} className="block w-full text-sm text-slate-500" />
                                    </div>
                                )}
                            </div>
                        ))}
                    </div>

                    <div className="flex justify-end gap-2">
                        <button type="button" onClick={() => navigate(-1)} className="px-4 py-2 border rounded">Cancel</button>
                        <button type="submit" disabled={submitting} className="px-4 py-2 bg-brand-primary text-white rounded">{submitting ? 'Submitting...' : 'Submit Record'}</button>
                    </div>
                </form>
            </Card>
        </div>
    );
};

export default AddEditMedicalRecord;