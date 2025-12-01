import { API_URL } from '../../config/api';

import React, { useEffect, useState } from 'react';
import { useAuth } from '../../contexts/AuthContext';
import Card from '../../components/Card';
import { useNavigate } from 'react-router-dom';
import { DetailedPatient } from '../../types';

const HealthSummaryItem: React.FC<{ label: string; value: string }> = ({ label, value }) => (
    <div className="text-center">
        <p className="text-sm text-slate-400 dark:text-slate-400">{label}</p>
        <p className="text-lg font-bold text-slate-900 dark:text-slate-100">{value}</p>
    </div>
);

const QuickInfoItem: React.FC<{ icon: string; label: string; value: string; color: string }> = ({ icon, label, value, color }) => (
    <div className="flex items-center py-2">
        <span className={`text-xl ${color}`}>{icon}</span>
        <span className="ml-3 text-sm font-medium text-slate-700 dark:text-slate-300">{label}:</span>
        <span className="ml-auto text-sm text-slate-900 dark:text-slate-100 font-semibold">{value}</span>
    </div>
);

const AuthorizedHospitalItem: React.FC<{ name: string; access: string }> = ({ name, access }) => (
     <li className="flex items-center justify-between py-2">
        <div className="flex items-center">
            <svg className="w-5 h-5 text-status-green" fill="currentColor" viewBox="0 0 20 20"><path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" /></svg>
            <span className="ml-2 text-sm font-medium text-slate-900 dark:text-slate-100">{name}</span>
        </div>
        <span className="text-sm text-slate-600 dark:text-slate-300">{access}</span>
    </li>
);

const PatientDashboard: React.FC = () => {
    const { user } = useAuth();
    const navigate = useNavigate();
    const [patient, setPatient] = useState<DetailedPatient | null>(null);
    const [showModal, setShowModal] = useState(false);
    const [form, setForm] = useState({ bloodGroup: '', age: '', height: '', weight: '', bmi: '' });
    const [saving, setSaving] = useState(false);

    const openModal = () => {
        setForm({
            bloodGroup: patient?.bloodGroup || '',
            age: patient?.age ? String(patient.age) : '',
            height: patient?.height || '',
            weight: patient?.weight ? String(patient.weight) : '',
            bmi: patient?.bmi ? String(patient.bmi) : '',
        });
        setShowModal(true);
    };

    const closeModal = () => setShowModal(false);

    const updateField = (k: string, v: string) => setForm(prev => ({ ...prev, [k]: v }));

    const saveHealthSummary = async () => {
        if (!user?.id) return alert('User not identified');
        setSaving(true);
        try {
            const body: any = {};
            if (form.bloodGroup) body.bloodGroup = form.bloodGroup;
            if (form.age) body.age = Number(form.age);
            if (form.height) body.height = form.height;
            if (form.weight) body.weight = Number(form.weight);
            if (form.bmi) body.bmi = Number(form.bmi);

            const resp = await fetch(`${API_URL}/patients/${user.id}`, {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(body),
            });
            const data = await resp.json();
            if (!resp.ok) return alert('Save failed: ' + (data?.error || data?.message || 'unknown'));
            setPatient(data.patient as DetailedPatient);
            setShowModal(false);
        } catch (err) {
            console.error('save health summary error', err);
            alert('Error saving health details');
        } finally {
            setSaving(false);
        }
    };

    useEffect(() => {
        const fetchPatient = async () => {
            if (!user?.id) return;
            try {
                const resp = await fetch(`${API_URL}/patients/${user.id}`);
                const data = await resp.json();
                if (resp.ok && data?.patient) setPatient(data.patient as DetailedPatient);
            } catch (err) {
                console.warn('Could not fetch patient details', err);
            }
        };
        fetchPatient();
    }, [user?.id]);

    const relativeTime = (iso?: string) => {
        if (!iso) return 'N/A';
        const d = new Date(iso).getTime();
        const diff = Date.now() - d;
        const mins = Math.floor(diff / 60000);
        if (mins < 1) return 'just now';
        if (mins < 60) return `${mins} min${mins>1?'s':''} ago`;
        const hrs = Math.floor(mins / 60);
        if (hrs < 24) return `${hrs} hour${hrs>1?'s':''} ago`;
        const days = Math.floor(hrs / 24);
        return `${days} day${days>1?'s':''} ago`;
    };

    return (
        <div className="space-y-6">
            <div>
                <h2 className="text-2xl font-bold text-slate-900 dark:text-slate-100">Welcome Back, {user?.name}!</h2>
                <p className="text-sm text-slate-600 dark:text-slate-300">Last Access: {relativeTime(user?.lastLogin || patient?.lastUpdated)}</p>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                <div className="lg:col-span-2 space-y-6">
                    <Card title="Your Health Summary">
                        <div className="flex justify-around items-center">
                            <HealthSummaryItem label="Blood Group" value={patient?.bloodGroup || 'Not provided'} />
                            <HealthSummaryItem label="Age" value={patient ? `${patient.age || '—'} years` : '—'} />
                            <HealthSummaryItem label="Height" value={patient?.height || '—'} />
                            <HealthSummaryItem label="Weight" value={patient?.weight || '—'} />
                            <HealthSummaryItem label="BMI" value={patient?.bmi || '—'} />
                        </div>
                        <div className="mt-4 text-center">
                            {!patient?.allergies?.length && !patient?.conditions?.length ? (
                                <>
                                    <p className="text-sm text-gray-500">No health details found.</p>
                                    <button onClick={openModal} className="mt-2 px-3 py-1 text-sm bg-brand-primary text-white rounded">Add Details</button>
                                </>
                            ) : (
                                <button onClick={openModal} className="mt-2 px-3 py-1 text-sm border border-brand-primary text-brand-primary rounded">Edit Details</button>
                            )}
                        </div>
                    </Card>
                    <Card title="Quick Actions">
                        <div className="flex flex-wrap gap-4">
                            <button onClick={() => navigate('/patient/health-history')} className="px-4 py-2 bg-brand-primary text-white text-sm rounded-md hover:bg-brand-secondary">View Full Medical History</button>
                            <button onClick={() => alert('Preparing your records for download...')} className="px-4 py-2 bg-gray-200 text-gray-800 text-sm rounded-md hover:bg-gray-300">Download Records</button>
                            <button onClick={() => navigate('/patient/settings')} className="px-4 py-2 bg-gray-200 text-gray-800 text-sm rounded-md hover:bg-gray-300">Manage Permissions</button>
                            <button onClick={() => navigate('/patient/settings')} className="px-4 py-2 bg-gray-200 text-gray-800 text-sm rounded-md hover:bg-gray-300">Edit Profile</button>
                        </div>
                    </Card>
                     <Card title="Authorized Hospitals">
                         <ul className="divide-y divide-gray-200">
                             <AuthorizedHospitalItem name="Apollo Hospital" access="Full Access" />
                             <AuthorizedHospitalItem name="City Hospital" access="Limited Access" />
                             <AuthorizedHospitalItem name="Max Healthcare" access="Read-Only" />
                         </ul>
                     </Card>
                </div>

                <div className="space-y-6">
                    <Card title="Quick Health Info">
                        <QuickInfoItem icon="🔺" label="Allergies" value={patient?.allergies?.length ? (Array.isArray(patient.allergies) ? (patient.allergies as any).join(', ') : String(patient.allergies)) : 'None'} color="text-red-500" />
                        <QuickInfoItem icon="❤️" label="Chronic Conditions" value={patient?.conditions?.length ? (patient.conditions as any).join(', ') : 'None'} color="text-red-600" />
                        <QuickInfoItem icon="💊" label="Active Medications" value={patient?.medications?.length ? `${patient.medications.length} medicines` : 'None'} color="text-yellow-500" />
                        <QuickInfoItem icon="📋" label="Recent Consultations" value={patient && (patient.consultationHistory as any)?.length ? `${(patient.consultationHistory as any).length} (Last: ${(patient.consultationHistory as any)[0]?.date || 'N/A'})` : 'None'} color="text-blue-500" />
                    </Card>
                    <Card title="Hospital Access History">
                        <ul className="divide-y divide-gray-200 text-sm">
                            <li className="py-2">Apollo Hospital - 15-Oct-2024</li>
                            <li className="py-2">City Hospital - 28-Sep-2024</li>
                            <li className="py-2">Max Healthcare - 10-Aug-2024</li>
                        </ul>
                        <button onClick={() => alert('Viewing all hospital accesses - TBI')} className="text-sm text-brand-accent hover:underline mt-2 w-full text-right">View All Accesses</button>
                    </Card>
                </div>
            </div>
            {showModal && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 dark:bg-black/60">
                    <div className="bg-white dark:bg-slate-900 rounded-lg p-6 w-full max-w-md ring-1 ring-slate-200 dark:ring-slate-800">
                        <h3 className="text-lg font-semibold text-slate-900 dark:text-slate-100">Health Summary</h3>
                        <p className="text-sm text-slate-500 mb-4">Add or edit your basic health details.</p>
                        <div className="space-y-3">
                            <div>
                                <label className="block text-sm text-slate-700">Blood Group</label>
                                <input value={form.bloodGroup} onChange={(e)=>updateField('bloodGroup', e.target.value)} className="mt-1 block w-full p-2 border border-slate-300 dark:border-slate-700 rounded bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 placeholder:text-slate-400 dark:placeholder:text-slate-500" placeholder="B+ / O-" />
                            </div>
                            <div className="grid grid-cols-2 gap-3">
                                <div>
                                    <label className="block text-sm text-slate-700">Age</label>
                                    <input type="number" value={form.age} onChange={(e)=>updateField('age', e.target.value)} className="mt-1 block w-full p-2 border border-slate-300 dark:border-slate-700 rounded bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 placeholder:text-slate-400 dark:placeholder:text-slate-500" />
                                </div>
                                <div>
                                    <label className="block text-sm text-slate-700">Height</label>
                                    <input value={form.height} onChange={(e)=>updateField('height', e.target.value)} placeholder={"e.g. 5'10\""} className="mt-1 block w-full p-2 border border-slate-300 dark:border-slate-700 rounded bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 placeholder:text-slate-400 dark:placeholder:text-slate-500" />
                                </div>
                            </div>
                            <div className="grid grid-cols-2 gap-3">
                                <div>
                                    <label className="block text-sm text-slate-700">Weight (kg)</label>
                                    <input type="number" value={form.weight} onChange={(e)=>updateField('weight', e.target.value)} className="mt-1 block w-full p-2 border border-slate-300 dark:border-slate-700 rounded bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 placeholder:text-slate-400 dark:placeholder:text-slate-500" />
                                </div>
                                <div>
                                    <label className="block text-sm text-slate-700">BMI</label>
                                    <input type="number" step="0.1" value={form.bmi} onChange={(e)=>updateField('bmi', e.target.value)} className="mt-1 block w-full p-2 border border-slate-300 dark:border-slate-700 rounded bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 placeholder:text-slate-400 dark:placeholder:text-slate-500" />
                                </div>
                            </div>
                        </div>
                        <div className="mt-6 flex justify-end gap-3">
                            <button onClick={closeModal} className="px-4 py-2 border rounded bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-200">Cancel</button>
                            <button onClick={saveHealthSummary} disabled={saving} className="px-4 py-2 bg-brand-primary text-white rounded">{saving ? 'Saving...' : 'Save'}</button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default PatientDashboard;