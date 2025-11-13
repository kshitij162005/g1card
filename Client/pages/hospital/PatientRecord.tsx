
import React, { useEffect, useMemo, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import Card from '../../components/Card';
import { DetailedPatient } from '../../types';
import { useAuth } from '../../contexts/AuthContext';

const Section: React.FC<{ title: string; onAdd?: () => void; children: React.ReactNode; }> = ({ title, onAdd, children }) => (
    <Card>
        <div className="flex justify-between items-center mb-4 pb-2 border-b dark:border-slate-700">
            <h3 className="text-lg font-semibold text-slate-800 dark:text-slate-200">{title}</h3>
            {onAdd && <button onClick={onAdd} className="text-sm px-3 py-1 bg-brand-light text-brand-primary rounded-lg hover:bg-blue-200 dark:bg-slate-700 dark:text-slate-200 dark:hover:bg-slate-600">+ ADD</button>}
        </div>
        {children}
    </Card>
);

const PatientRecord: React.FC = () => {
    const { patientId } = useParams<{ patientId: string }>();
    const navigate = useNavigate();
    const { user } = useAuth();
    const [patient, setPatient] = useState<DetailedPatient | null>(null);
    const [loading, setLoading] = useState(true);
    const [records, setRecords] = useState<any[]>([]);
    const [loadingRecords, setLoadingRecords] = useState(false);
    const [activeTab, setActiveTab] = useState<'overview' | 'records'>('overview');

    useEffect(() => {
        if (!patientId) { setLoading(false); return; }
        (async () => {
            try {
                const resp = await fetch(`http://localhost:8082/api/patients/${patientId}`);
                const data = await resp.json();
                if (!resp.ok) throw new Error(data.error || 'Not found');
                // Normalize server patient to DetailedPatient shape minimally
                const p = data.patient || {};
                const detailed: DetailedPatient = {
                    id: p._id || patientId,
                    name: p.name || `${p.firstName || ''} ${p.lastName || ''}`.trim(),
                    dob: p.dob || '',
                    age: p.age || 0,
                    gender: p.gender || '',
                    contact: p.phone || '',
                    email: p.email || p.username || '',
                    address: p.address || '',
                    bloodGroup: p.bloodGroup || '',
                    height: p.height || '',
                    weight: p.weight ? String(p.weight) : '',
                    bmi: p.bmi ? String(p.bmi) : '',
                    allergies: (p.allergies || []).map((a:any) => ({ name: a, severity: '' })),
                    chronicConditions: (p.conditions || []).map((c:any) => ({ name: c, diagnosed: '' })),
                    currentMedications: (p.medications || []).map((m:any) => ({ name: m, dosage: '', since: '', prescribedBy: '' })),
                    previousSurgeries: (p.surgeries || []).map((s:any) => ({ name: s, date: '', hospital: '', doctor: '', treatment: '' })),
                    immunizationRecords: [],
                    consultationHistory: [],
                    uploadedDocuments: [],
                    lastUpdated: p.updatedAt || '',
                    created: p.createdAt || '',
                };
                setPatient(detailed);
            } catch (err) {
                console.error('fetch patient', err);
                setPatient(null);
            } finally { setLoading(false); }
        })();
    }, [patientId]);

    useEffect(() => {
        if (!patientId) return;
        (async () => {
            setLoadingRecords(true);
            try {
                const resp = await fetch(`http://localhost:8082/api/patients/${patientId}/records`);
                const data = await resp.json();
                if (resp.ok && data.records) {
                    setRecords(data.records || []);
                }
            } catch (err) {
                console.error('fetch records', err);
            } finally {
                setLoadingRecords(false);
            }
        })();
    }, [patientId]);

    const pinnedRecords = useMemo(() => {
        if (!user) return [];
        return records.filter(record => record.hospital && record.hospital._id === user.id);
    }, [records, user]);

    const otherRecords = useMemo(() => {
        if (!user) return records;
        return records.filter(record => !record.hospital || record.hospital._id !== user.id);
    }, [records, user]);

    const allRecordsOrdered = useMemo(() => {
        return [...pinnedRecords, ...otherRecords];
    }, [pinnedRecords, otherRecords]);

    const humanize = (value: string) => {
        return value
            .replace(/[_\-]+/g, ' ')
            .replace(/\s+/g, ' ')
            .trim()
            .replace(/\b\w/g, char => char.toUpperCase());
    };

    const formatFieldType = (type?: string) => {
        switch (type) {
            case 'text': return 'Text';
            case 'number': return 'Number';
            case 'date': return 'Date';
            case 'textarea': return 'Long Text';
            case 'select': return 'Dropdown';
            case 'file': return 'File';
            default: return 'Field';
        }
    };

    if (loading) return <div className="text-center p-8">Loading...</div>;
    if (!patient) return <div className="text-center p-8">Patient data not found.</div>;

    const handleAddRecord = () => {
        navigate(`/hospital/patients/${patientId}/add-record`);
    };

    return (
        <div className="space-y-6">
            <div className="flex flex-col md:flex-row justify-between md:items-center gap-4">
                <div>
                    <h2 className="text-2xl font-bold text-slate-800 dark:text-slate-200">PATIENT RECORD - {patient.name} (ID: {patient.id})</h2>
                    <div className="text-sm text-slate-500 dark:text-slate-400 mt-1">
                        <span>Last Updated: {patient.lastUpdated}</span> | <span>Created: {patient.created}</span>
                    </div>
                </div>
                <div className="flex gap-2">
                    <button onClick={() => navigate(-1)} className="px-4 py-2 bg-slate-200 text-slate-800 text-sm rounded-lg hover:bg-slate-300 dark:bg-slate-700 dark:text-slate-200 dark:hover:bg-slate-600">&larr; Back</button>
                    <button className="px-4 py-2 bg-slate-200 text-slate-800 text-sm rounded-lg hover:bg-slate-300 dark:bg-slate-700 dark:text-slate-200 dark:hover:bg-slate-600">Edit Profile</button>
                    <button onClick={handleAddRecord} className="px-4 py-2 bg-brand-primary text-white text-sm rounded-lg hover:bg-brand-secondary">Add Record</button>
                </div>
            </div>

            <div className="flex flex-wrap gap-3">
                <button
                    onClick={() => setActiveTab('overview')}
                    className={`px-4 py-2 text-sm rounded-lg border transition-colors ${activeTab === 'overview'
                        ? 'bg-brand-primary text-white border-brand-primary'
                        : 'bg-slate-200 text-slate-700 dark:bg-slate-700 dark:text-slate-200 border-transparent hover:bg-slate-300 dark:hover:bg-slate-600'
                    }`}
                >
                    General Information
                </button>
                <button
                    onClick={() => setActiveTab('records')}
                    className={`px-4 py-2 text-sm rounded-lg border transition-colors ${activeTab === 'records'
                        ? 'bg-brand-primary text-white border-brand-primary'
                        : 'bg-slate-200 text-slate-700 dark:bg-slate-700 dark:text-slate-200 border-transparent hover:bg-slate-300 dark:hover:bg-slate-600'
                    }`}
                >
                    Hospital Records
                </button>
            </div>

            {activeTab === 'overview' && (
                <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                    <div className="lg:col-span-1 space-y-6">
                        <Section title="Personal Information">
                            <ul className="text-sm space-y-2">
                                <li><strong>Name:</strong> {patient.name}</li>
                                <li><strong>DOB:</strong> {patient.dob} (Age: {patient.age})</li>
                                <li><strong>Gender:</strong> {patient.gender}</li>
                                <li><strong>Contact:</strong> {patient.contact}</li>
                                <li><strong>Email:</strong> {patient.email}</li>
                                <li><strong>Address:</strong> {patient.address}</li>
                            </ul>
                        </Section>
                        <Section title="Health Information">
                            <ul className="text-sm space-y-2">
                                <li><strong>Blood Group:</strong> {patient.bloodGroup}</li>
                                <li><strong>Height:</strong> {patient.height}</li>
                                <li><strong>Weight:</strong> {patient.weight}</li>
                                <li><strong>BMI:</strong> {patient.bmi}</li>
                            </ul>
                        </Section>
                        <Section title="Allergies & Intolerances">
                            <ul className="list-disc list-inside text-sm space-y-1">
                                {patient.allergies.map(item => <li key={item.name}>{item.name} ({item.severity})</li>)}
                            </ul>
                        </Section>
                    </div>

                    <div className="lg:col-span-2 space-y-6">
                        <Section title="Chronic Conditions">
                            <ul className="list-disc list-inside text-sm space-y-1">
                                {patient.chronicConditions.map(item => <li key={item.name}>{item.name} (Diagnosed: {item.diagnosed})</li>)}
                            </ul>
                        </Section>
                        <Section title="Current Medications">
                            {patient.currentMedications.map((med, index) => (
                                <div key={index} className={`text-sm ${index > 0 ? 'mt-3 pt-3 border-t dark:border-slate-700' : ''}`}>
                                    <p className="font-semibold">{med.name} - {med.dosage}</p>
                                    <p className="text-xs text-slate-600 dark:text-slate-400">Since: {med.since} | Prescribed by: {med.prescribedBy}</p>
                                </div>
                            ))}
                        </Section>
                        <Section title="Previous Surgeries & Injuries">
                            {patient.previousSurgeries.map((item, index) => (
                                <div key={index} className={`text-sm ${index > 0 ? 'mt-3 pt-3 border-t dark:border-slate-700' : ''}`}>
                                    <p className="font-semibold">{item.name} - {item.date}</p>
                                    <p className="text-xs text-slate-600 dark:text-slate-400">Hospital: {item.hospital} | Doctor: {item.doctor}</p>
                                    <p className="text-xs text-slate-600 dark:text-slate-400">Treatment: {item.treatment}</p>
                                </div>
                            ))}
                        </Section>
                        <Section title="Immunization Records">
                            <ul className="list-disc list-inside text-sm grid grid-cols-2 gap-x-4 gap-y-1">
                                {patient.immunizationRecords.map(item => <li key={item.name}>{item.name} - {item.date}</li>)}
                            </ul>
                        </Section>
                        <Section title="Consultation History">
                            <table className="w-full text-sm text-left">
                                <thead className="text-xs text-slate-700 uppercase bg-slate-50 dark:bg-slate-700 dark:text-slate-400">
                                    <tr><th className="px-2 py-2">Date</th><th className="px-2 py-2">Hospital</th><th className="px-2 py-2">Doctor</th><th className="px-2 py-2">Reason</th></tr>
                                </thead>
                                <tbody className="dark:text-slate-300">
                                    {patient.consultationHistory.map((item, index) => (
                                        <tr key={index} className="border-b dark:border-slate-700"><td className="px-2 py-2">{item.date}</td><td className="px-2 py-2">{item.hospital}</td><td className="px-2 py-2">{item.doctor}</td><td className="px-2 py-2">{item.reason}</td></tr>
                                    ))}
                                </tbody>
                            </table>
                        </Section>
                        <Section title="Uploaded Medical Documents">
                            <ul className="text-sm space-y-2">
                                {patient.uploadedDocuments.map(doc => (
                                    <li key={doc.name} className="flex items-center justify-between p-2 bg-slate-50 dark:bg-slate-700/50 rounded-lg">
                                        <span>📄 {doc.name} - {doc.date}</span>
                                        <button className="text-xs text-brand-accent hover:underline">View</button>
                                    </li>
                                ))}
                            </ul>
                            <button className="mt-4 w-full text-sm px-3 py-2 bg-slate-100 text-slate-700 rounded-lg hover:bg-slate-200 dark:bg-slate-700 dark:text-slate-200 dark:hover:bg-slate-600">Download All</button>
                        </Section>
                    </div>
                </div>
            )}

            {activeTab === 'records' && (
                <div className="space-y-4">
                    <div className="flex justify-between items-center">
                        <h3 className="text-lg font-semibold text-slate-800 dark:text-slate-200">Hospital Records</h3>
                        <button onClick={handleAddRecord} className="px-4 py-2 text-sm bg-brand-primary text-white rounded-lg hover:bg-brand-secondary">+ Add Record</button>
                    </div>
                    {loadingRecords ? (
                        <Card><p className="text-sm text-slate-500 dark:text-slate-400">Loading records...</p></Card>
                    ) : allRecordsOrdered.length === 0 ? (
                        <Card><p className="text-sm text-slate-500 dark:text-slate-400">No medical records found yet.</p></Card>
                    ) : (
                        allRecordsOrdered.map((record, idx) => {
                            const isPinned = user && record.hospital && record.hospital._id === user.id;
                            return (
                                <Card key={record._id || idx} className={`border ${isPinned ? 'border-brand-primary/80 shadow-lg' : 'border-slate-200 dark:border-slate-700'}`}>
                                    <div className="flex flex-col md:flex-row md:items-start md:justify-between gap-3 pb-4 border-b dark:border-slate-700">
                                        <div>
                                            <div className="flex items-center gap-2">
                                                <h4 className="text-base font-semibold text-slate-800 dark:text-slate-200">
                                                    {record.form?.name || 'Custom Record'}
                                                </h4>
                                                {isPinned && <span className="px-2 py-0.5 text-xs rounded-full bg-brand-light text-brand-primary font-medium">Your Hospital</span>}
                                            </div>
                                            <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">
                                                {record.hospital?.name || 'Unknown Hospital'}
                                            </p>
                                            {record.form?.description && (
                                                <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
                                                    {record.form.description}
                                                </p>
                                            )}
                                        </div>
                                        <div className="text-xs text-slate-500 dark:text-slate-400">
                                            <p>Added on {new Date(record.createdAt).toLocaleString()}</p>
                                            {record.updatedAt && <p>Last updated {new Date(record.updatedAt).toLocaleString()}</p>}
                                        </div>
                                    </div>
                                    <div className="pt-4 space-y-3">
                                        {Object.entries(record.data || {}).map(([key, value]) => {
                                            const meta = record.form?.fields?.find((f: any) => f.key === key);
                                            const label = meta?.label || humanize(key);
                                            const typeLabel = formatFieldType(meta?.type);
                                            return (
                                                <div key={key} className="flex flex-col sm:flex-row sm:items-center sm:justify-between bg-slate-50 dark:bg-slate-800/60 px-3 py-2 rounded-lg">
                                                    <div className="flex flex-col">
                                                        <span className="text-sm font-medium text-slate-700 dark:text-slate-200">{label}</span>
                                                        <span className="text-xs text-slate-500 dark:text-slate-400">{typeLabel}</span>
                                                    </div>
                                                    <span className="text-sm text-slate-700 dark:text-slate-200 mt-2 sm:mt-0 sm:ml-4 break-words max-w-3xl">{String(value) || '—'}</span>
                                                </div>
                                            );
                                        })}
                                        {record.attachments && record.attachments.length > 0 && (
                                            <div className="pt-3 border-t dark:border-slate-700">
                                                <p className="text-xs font-medium text-slate-700 dark:text-slate-300 mb-2">Attachments</p>
                                                <div className="flex flex-wrap gap-2">
                                                    {record.attachments.map((att: any, attIdx: number) => (
                                                        <span key={attIdx} className="text-xs px-2 py-1 bg-slate-200 dark:bg-slate-700 rounded">
                                                            {att.name || `File ${attIdx + 1}`}
                                                        </span>
                                                    ))}
                                                </div>
                                            </div>
                                        )}
                                    </div>
                                </Card>
                            );
                        })
                    )}
                </div>
            )}
        </div>
    );
};

export default PatientRecord;