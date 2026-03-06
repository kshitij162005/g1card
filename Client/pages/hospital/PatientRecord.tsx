import { API_URL } from '../../config/api';

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

const RecordCard: React.FC<{ 
    record: any; 
    isPinned: boolean; 
    humanize: (value: string) => string; 
    formatFieldType: (type?: string) => string;
}> = ({ record, isPinned, humanize, formatFieldType }) => {
    const [isExpanded, setIsExpanded] = useState(false);
    const dataEntries = Object.entries(record.data || {});
    const fieldCount = dataEntries.length;
    
    return (
        <Card className={`border ${isPinned ? 'border-brand-primary/80 shadow-md' : 'border-slate-200 dark:border-slate-700'}`}>
            <div 
                className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 cursor-pointer"
                onClick={() => setIsExpanded(!isExpanded)}
            >
                <div className="flex items-center gap-3 flex-1 min-w-0">
                    <button className="flex-shrink-0 w-6 h-6 flex items-center justify-center rounded bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-600 transition-colors">
                        <svg className={`w-4 h-4 transition-transform ${isExpanded ? 'rotate-90' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                        </svg>
                    </button>
                    <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                            <h4 className="text-sm font-semibold text-slate-800 dark:text-slate-200 truncate">
                                {record.form?.name || 'Custom Record'}
                            </h4>
                            {isPinned && <span className="px-1.5 py-0.5 text-xs rounded bg-brand-light text-brand-primary font-medium flex-shrink-0">Your Hospital</span>}
                            <span className="text-xs text-slate-400 dark:text-slate-500 flex-shrink-0">({fieldCount} fields)</span>
                        </div>
                        <p className="text-xs text-slate-500 dark:text-slate-400 truncate">
                            {record.hospital?.name || 'Unknown Hospital'} • {new Date(record.createdAt).toLocaleDateString()}
                        </p>
                    </div>
                </div>
                <div className="flex items-center gap-2 text-xs text-slate-500 dark:text-slate-400 flex-shrink-0 sm:text-right">
                    <span className="hidden sm:inline">{new Date(record.createdAt).toLocaleTimeString()}</span>
                </div>
            </div>
            
            {isExpanded && (
                <div className="mt-3 pt-3 border-t dark:border-slate-700 space-y-2">
                    {record.form?.description && (
                        <p className="text-xs text-slate-500 dark:text-slate-400 italic mb-2">{record.form.description}</p>
                    )}
                    {dataEntries.map(([key, value]) => {
                        const meta = record.form?.fields?.find((f: any) => f.key === key);
                        const label = meta?.label || humanize(key);
                        const displayValue = Array.isArray(value) ? value.join(', ') : String(value);
                        return (
                            <div key={key} className="flex flex-col sm:flex-row sm:items-start gap-1 sm:gap-4 py-1.5 px-2 bg-slate-50 dark:bg-slate-800/60 rounded text-sm">
                                <span className="font-medium text-slate-600 dark:text-slate-300 sm:w-40 flex-shrink-0">{label}:</span>
                                <span className="text-slate-700 dark:text-slate-200 break-words flex-1">{displayValue || '—'}</span>
                            </div>
                        );
                    })}
                    {record.attachments && record.attachments.length > 0 && (
                        <div className="pt-2 border-t dark:border-slate-700">
                            <p className="text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">Attachments:</p>
                            <div className="flex flex-wrap gap-1">
                                {record.attachments.map((att: any, attIdx: number) => (
                                    <span key={attIdx} className="text-xs px-2 py-0.5 bg-slate-200 dark:bg-slate-700 rounded">
                                        {att.name || `File ${attIdx + 1}`}
                                    </span>
                                ))}
                            </div>
                        </div>
                    )}
                </div>
            )}
        </Card>
    );
};

const PatientRecord: React.FC = () => {
    const { patientId } = useParams<{ patientId: string }>();
    const navigate = useNavigate();
    const { user } = useAuth();
    const [patient, setPatient] = useState<DetailedPatient | null>(null);
    const [loading, setLoading] = useState(true);
    const [records, setRecords] = useState<any[]>([]);
    const [loadingRecords, setLoadingRecords] = useState(false);
    const [activeTab, setActiveTab] = useState<'overview' | 'records'>('overview');
    const [pinnedPage, setPinnedPage] = useState(1);
    const [otherPage, setOtherPage] = useState(1);
    const RECORDS_PER_PAGE = 10;

    useEffect(() => {
        if (!patientId || !user) { setLoading(false); return; }
        (async () => {
            try {
                const resp = await fetch(`${API_URL}/hospitals/${user.id}/patients/${patientId}/summary`);
                const data = await resp.json();
                if (!resp.ok) throw new Error(data.error || 'Not found');
                const p = data.patient || {};
                const detailed: DetailedPatient = {
                    id: p.id || patientId,
                    name: p.name || '',
                    dob: p.dob || '',
                    age: p.age || 0,
                    gender: p.gender || '',
                    contact: p.phone || '',
                    email: p.email || '',
                    address: p.address || '',
                    bloodGroup: p.bloodGroup || '',
                    height: p.height || '',
                    weight: p.weight ? String(p.weight) : '',
                    bmi: p.bmi ? String(p.bmi) : '',
                    allergies: (p.allergies || []).map((a:any) => ({ name: a, severity: '' })),
                    chronicConditions: (p.conditions || []).map((c:any) => ({ name: c, diagnosed: '' })),
                    currentMedications: (p.medications || []).map((m:any) => ({ name: m, dosage: '', since: '', prescribedBy: '' })),
                    previousSurgeries: (p.surgeries || []).map((s:any) => ({ name: s, date: '', hospital: '', doctor: '', treatment: '' })),
                    immunizationRecords: (p.immunizationRecords || p.immunizations || []).map((i:any) => ({
                        name: i?.name || i?.vaccine || String(i || ''),
                        date: i?.date || i?.takenOn || '',
                    })),
                    consultationHistory: [],
                    uploadedDocuments: [],
                    lastUpdated: p.lastUpdated || '',
                    created: p.created || '',
                };
                setPatient(detailed);
            } catch (err) {
                console.error('fetch patient summary', err);
                setPatient(null);
            } finally { setLoading(false); }
        })();
    }, [patientId, user]);

    useEffect(() => {
        if (!patientId || !user) return;
        (async () => {
            setLoadingRecords(true);
            try {
                const resp = await fetch(`${API_URL}/hospitals/${user.id}/patients/${patientId}/records`);
                const data = await resp.json();
                if (resp.ok && data.records) {
                    setRecords(data.records || []);
                } else if (!resp.ok) {
                    console.error('fetch records error', data.error);
                }
            } catch (err) {
                console.error('fetch records', err);
            } finally {
                setLoadingRecords(false);
            }
        })();
    }, [patientId, user]);

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

    // Pagination for pinned records
    const pinnedTotalPages = Math.ceil(pinnedRecords.length / RECORDS_PER_PAGE);
    const paginatedPinnedRecords = useMemo(() => {
        const start = (pinnedPage - 1) * RECORDS_PER_PAGE;
        return pinnedRecords.slice(start, start + RECORDS_PER_PAGE);
    }, [pinnedRecords, pinnedPage]);

    // Pagination for other records
    const otherTotalPages = Math.ceil(otherRecords.length / RECORDS_PER_PAGE);
    const paginatedOtherRecords = useMemo(() => {
        const start = (otherPage - 1) * RECORDS_PER_PAGE;
        return otherRecords.slice(start, start + RECORDS_PER_PAGE);
    }, [otherRecords, otherPage]);

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
                        <>
                            {/* Your Hospital's Records */}
                            {pinnedRecords.length > 0 && (
                                <div className="space-y-3">
                                    <div className="flex items-center gap-2">
                                        <div className="h-px flex-1 bg-brand-primary/30"></div>
                                        <span className="text-sm font-semibold text-brand-primary dark:text-brand-accent px-2">Your Hospital's Records ({pinnedRecords.length})</span>
                                        <div className="h-px flex-1 bg-brand-primary/30"></div>
                                    </div>
                                    {paginatedPinnedRecords.map((record, idx) => (
                                        <RecordCard key={record._id || idx} record={record} isPinned={true} humanize={humanize} formatFieldType={formatFieldType} />
                                    ))}
                                    {/* Pagination for pinned records */}
                                    {pinnedTotalPages > 1 && (
                                        <div className="flex items-center justify-center gap-2 pt-3">
                                            <button
                                                onClick={() => setPinnedPage(p => Math.max(1, p - 1))}
                                                disabled={pinnedPage === 1}
                                                className="px-3 py-1.5 text-sm rounded-lg bg-slate-100 dark:bg-slate-700 text-slate-700 dark:text-slate-200 hover:bg-slate-200 dark:hover:bg-slate-600 disabled:opacity-50 disabled:cursor-not-allowed"
                                            >
                                                Previous
                                            </button>
                                            <span className="text-sm text-slate-600 dark:text-slate-400">
                                                Page {pinnedPage} of {pinnedTotalPages}
                                            </span>
                                            <button
                                                onClick={() => setPinnedPage(p => Math.min(pinnedTotalPages, p + 1))}
                                                disabled={pinnedPage === pinnedTotalPages}
                                                className="px-3 py-1.5 text-sm rounded-lg bg-slate-100 dark:bg-slate-700 text-slate-700 dark:text-slate-200 hover:bg-slate-200 dark:hover:bg-slate-600 disabled:opacity-50 disabled:cursor-not-allowed"
                                            >
                                                Next
                                            </button>
                                        </div>
                                    )}
                                </div>
                            )}

                            {/* Other Hospitals' Records */}
                            {otherRecords.length > 0 && (
                                <div className="space-y-3">
                                    <div className="flex items-center gap-2 mt-6">
                                        <div className="h-px flex-1 bg-slate-300 dark:bg-slate-600"></div>
                                        <span className="text-sm font-semibold text-slate-500 dark:text-slate-400 px-2">Other Hospitals' Records ({otherRecords.length})</span>
                                        <div className="h-px flex-1 bg-slate-300 dark:bg-slate-600"></div>
                                    </div>
                                    {paginatedOtherRecords.map((record, idx) => (
                                        <RecordCard key={record._id || idx} record={record} isPinned={false} humanize={humanize} formatFieldType={formatFieldType} />
                                    ))}
                                    {/* Pagination for other records */}
                                    {otherTotalPages > 1 && (
                                        <div className="flex items-center justify-center gap-2 pt-3">
                                            <button
                                                onClick={() => setOtherPage(p => Math.max(1, p - 1))}
                                                disabled={otherPage === 1}
                                                className="px-3 py-1.5 text-sm rounded-lg bg-slate-100 dark:bg-slate-700 text-slate-700 dark:text-slate-200 hover:bg-slate-200 dark:hover:bg-slate-600 disabled:opacity-50 disabled:cursor-not-allowed"
                                            >
                                                Previous
                                            </button>
                                            <span className="text-sm text-slate-600 dark:text-slate-400">
                                                Page {otherPage} of {otherTotalPages}
                                            </span>
                                            <button
                                                onClick={() => setOtherPage(p => Math.min(otherTotalPages, p + 1))}
                                                disabled={otherPage === otherTotalPages}
                                                className="px-3 py-1.5 text-sm rounded-lg bg-slate-100 dark:bg-slate-700 text-slate-700 dark:text-slate-200 hover:bg-slate-200 dark:hover:bg-slate-600 disabled:opacity-50 disabled:cursor-not-allowed"
                                            >
                                                Next
                                            </button>
                                        </div>
                                    )}
                                </div>
                            )}
                        </>
                    )}
                </div>
            )}
        </div>
    );
};

export default PatientRecord;