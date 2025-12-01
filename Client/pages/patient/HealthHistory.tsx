import { API_URL } from '../../config/api';


import React, { useEffect, useState } from 'react';
import Card from '../../components/Card';
import { DetailedPatient } from '../../types';
import { useAuth } from '../../contexts/AuthContext';

// Normalize arrays that may be stored as strings or objects in DB
const normalizeList = (list: any[] | undefined) => {
    if (!list) return [];
    // if strings -> convert to simple objects
    if (list.length && typeof list[0] === 'string') return list.map((s: string) => ({ name: s }));
    return list;
};

const Section: React.FC<{ title: string; children: React.ReactNode; }> = ({ title, children }) => (
     <div className="mb-8">
        <h3 className="text-xl font-semibold text-slate-800 dark:text-slate-200 mb-4 pb-2 border-b-2 border-brand-primary">{title}</h3>
        {children}
    </div>
);


const HealthHistory: React.FC = () => {
    const { user } = useAuth();
    const [patient, setPatient] = useState<DetailedPatient | null>(null);

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

    const allergies = normalizeList(patient?.allergies as any[]);
    const conditions = normalizeList(patient?.conditions as any[]);
    const meds = normalizeList(patient?.medications as any[]);
    const docs = patient?.uploadedDocuments || [];
    const consultations = patient?.consultationHistory || [];

    return (
        <Card>
            <div className="p-4">
                <div className="flex flex-col md:flex-row justify-between items-center mb-6">
                    <h2 className="text-2xl font-bold text-slate-900 dark:text-slate-100">Complete Medical History</h2>
                    <div className="flex items-center gap-2 mt-4 md:mt-0">
                        <select className="border border-slate-300 dark:border-slate-600 rounded-lg p-2 text-sm">
                            <option>Filter by Type</option>
                            <option>Consultation</option>
                            <option>Lab Report</option>
                        </select>
                        <input type="date" className="border border-slate-300 dark:border-slate-600 rounded-lg p-2 text-sm"/>
                        <button onClick={() => alert('Preparing a zip file with all your records.')} className="px-4 py-2 bg-brand-primary text-white rounded-lg hover:bg-brand-secondary text-sm">Download All</button>
                        <button onClick={() => window.print()} className="px-4 py-2 bg-slate-200 dark:bg-slate-700 text-slate-800 dark:text-slate-200 rounded-lg hover:bg-slate-300 dark:hover:bg-slate-600 text-sm">Print</button>
                    </div>
                </div>

                <div className="space-y-8">
                    <Section title="Consultation History">
                        <table className="w-full text-sm text-left">
                           <thead className="text-xs text-slate-700 uppercase bg-slate-50 dark:bg-slate-700 dark:text-slate-400">
                               <tr>
                                   <th className="px-4 py-2">Date</th>
                                   <th className="px-4 py-2">Hospital</th>
                                   <th className="px-4 py-2">Doctor</th>
                                   <th className="px-4 py-2">Type</th>
                                   <th className="px-4 py-2"></th>
                               </tr>
                           </thead>
                           <tbody className="text-slate-700 dark:text-slate-300">
                               {(consultations as any[]).map((item: any, index: number) => (
                                   <tr key={index} className="border-b dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-600/50">
                                       <td className="px-4 py-2">{item.date || '—'}</td>
                                       <td className="px-4 py-2">{item.hospital || '—'}</td>
                                       <td className="px-4 py-2">{item.doctor || '—'}</td>
                                       <td className="px-4 py-2">{item.reason || item.type || '—'}</td>
                                       <td className="px-4 py-2 text-right"><button onClick={() => alert(`Viewing details for consultation on ${item.date || 'N/A'}`)} className="text-brand-accent hover:underline">View Details</button></td>
                                   </tr>
                               ))}
                           </tbody>
                        </table>
                    </Section>

                    <Section title="Lab Reports">
                        <ul className="space-y-3">
                            {(docs as any[]).map((doc: any, index: number) => (
                                <li key={index} className="flex items-center justify-between p-3 bg-slate-50 dark:bg-slate-700/50 rounded-lg">
                                    <span className="font-medium">📄 {doc.name || doc.title || 'Report'}</span>
                                    <div className="flex items-center gap-4">
                                        <span className="text-xs text-slate-500 dark:text-slate-400">{doc.date || doc.hospital || ''}</span>
                                        <button onClick={() => alert(`Viewing report: ${doc.name || doc.title || 'Report'}`)} className="text-sm text-brand-accent hover:underline">View</button>
                                        <button onClick={() => alert(`Downloading report: ${doc.name || doc.title || 'Report'}`)} className="text-sm text-brand-accent hover:underline">Download</button>
                                    </div>
                                </li>
                            ))}
                        </ul>
                    </Section>

                    <Section title="Prescriptions">
                         <ul className="space-y-3">
                            {(meds as any[]).map((med: any, index: number) => (
                                <li key={index} className="flex items-center justify-between p-3 bg-slate-50 dark:bg-slate-700/50 rounded-lg">
                                    <span className="font-medium">💊 {med.name || med}</span>
                                    <div className="flex items-center gap-4">
                                        <span className="text-xs text-slate-500 dark:text-slate-400">Issued: {med.since || med.date || '—'} by {med.prescribedBy || med.prescriber || '—'}</span>
                                        <button onClick={() => alert(`Viewing prescription for ${med.name || med}`)} className="text-sm text-brand-accent hover:underline">View</button>
                                        <button onClick={() => window.print()} className="text-sm text-brand-accent hover:underline">Print</button>
                                    </div>
                                </li>
                            ))}
                        </ul>
                    </Section>

                    <Section title="Timeline View">
                        <div className="border-l-2 border-brand-accent pl-6 space-y-6">
                             <div>
                                <h4 className="font-semibold text-lg text-slate-800 dark:text-slate-200">Recent</h4>
                                <div className="ml-4 mt-2 space-y-4">
                                    {(consultations as any[]).slice(0, 5).map((c: any, idx: number) => (
                                        <div key={idx} className="relative">
                                            <div className="absolute -left-8 top-1.5 h-3 w-3 bg-brand-primary rounded-full"></div>
                                            <p className="font-semibold">{new Date(c.date || '').toLocaleString() || 'Unknown'}</p>
                                            <p className="text-sm ml-4">- {c.reason || c.hospital || 'Consultation'}</p>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        </div>
                    </Section>
                </div>
            </div>
        </Card>
    );
};

export default HealthHistory;