

import React from 'react';
import Card from '../../components/Card';
import { DetailedPatient } from '../../types';

const mockPatientData: DetailedPatient = {
    id: 'P12345', name: 'John Doe', dob: '15-05-1990', age: 34, gender: 'Male', contact: '+91-9876543210', email: 'john@example.com', address: 'Mumbai, Maharashtra', bloodGroup: 'B+', height: "5'10\"", weight: '75 kg', bmi: '24.5 (Normal)',
    allergies: [{ name: 'Penicillin', severity: 'Antibiotic' }],
    chronicConditions: [{ name: 'Hypertension', diagnosed: '2018' }],
    currentMedications: [
        { name: 'Lisinopril 10mg + Metformin 500mg', dosage: '', since: '15-Oct-2024', prescribedBy: 'Dr. Patel' },
        { name: 'Aspirin 100mg Daily', dosage: '', since: '28-Sep-2024', prescribedBy: 'Dr. Rajesh' },
    ],
    previousSurgeries: [{ name: 'Appendectomy', date: '10-May-2015', hospital: 'Max Healthcare', doctor: 'Dr. Sharma', treatment: 'Surgical Removal' }],
    immunizationRecords: [{ name: 'Tetanus Booster', date: '05-Jun-2022' }],
    consultationHistory: [
        { date: '15-Oct-2024', hospital: 'Apollo', doctor: 'Dr. P...', reason: 'Check-up' },
        { date: '28-Sep-2024', hospital: 'City Hosp', doctor: 'Dr. R...', reason: 'Follow-up' },
        { date: '10-Aug-2024', hospital: 'Apollo', doctor: 'Dr. A...', reason: 'Lab Test' },
    ],
    uploadedDocuments: [
        { name: 'Blood Test Report - 15-Oct-2024', date: 'Apollo Hospital', type: 'pdf' },
        { name: 'CT Scan Report - 28-Sep-2024', date: 'City Hospital', type: 'pdf' },
        { name: 'X-Ray Report - 10-Aug-2024', date: 'Apollo Hospital', type: 'pdf' },
    ],
    lastUpdated: '2 hours ago by Dr. Rajesh', created: '20-Mar-2022',
};

const Section: React.FC<{ title: string; children: React.ReactNode; }> = ({ title, children }) => (
     <div className="mb-8">
        <h3 className="text-xl font-semibold text-slate-800 dark:text-slate-200 mb-4 pb-2 border-b-2 border-brand-primary">{title}</h3>
        {children}
    </div>
);


const HealthHistory: React.FC = () => {
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
                               {mockPatientData.consultationHistory.map((item, index) => (
                                   <tr key={index} className="border-b dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-600/50">
                                       <td className="px-4 py-2">{item.date}</td>
                                       <td className="px-4 py-2">{item.hospital}</td>
                                       <td className="px-4 py-2">{item.doctor}</td>
                                       <td className="px-4 py-2">{item.reason}</td>
                                       <td className="px-4 py-2 text-right"><button onClick={() => alert(`Viewing details for consultation on ${item.date}`)} className="text-brand-accent hover:underline">View Details</button></td>
                                   </tr>
                               ))}
                           </tbody>
                        </table>
                    </Section>

                    <Section title="Lab Reports">
                        <ul className="space-y-3">
                            {mockPatientData.uploadedDocuments.map((doc, index) => (
                                <li key={index} className="flex items-center justify-between p-3 bg-slate-50 dark:bg-slate-700/50 rounded-lg">
                                    <span className="font-medium">📄 {doc.name}</span>
                                    <div className="flex items-center gap-4">
                                        <span className="text-xs text-slate-500 dark:text-slate-400">{doc.date}</span>
                                        <button onClick={() => alert(`Viewing report: ${doc.name}`)} className="text-sm text-brand-accent hover:underline">View</button>
                                        <button onClick={() => alert(`Downloading report: ${doc.name}`)} className="text-sm text-brand-accent hover:underline">Download</button>
                                    </div>
                                </li>
                            ))}
                        </ul>
                    </Section>

                    <Section title="Prescriptions">
                         <ul className="space-y-3">
                            {mockPatientData.currentMedications.map((med, index) => (
                                <li key={index} className="flex items-center justify-between p-3 bg-slate-50 dark:bg-slate-700/50 rounded-lg">
                                    <span className="font-medium">💊 {med.name}</span>
                                    <div className="flex items-center gap-4">
                                        <span className="text-xs text-slate-500 dark:text-slate-400">Issued: {med.since} by {med.prescribedBy}</span>
                                        <button onClick={() => alert(`Viewing prescription for ${med.name}`)} className="text-sm text-brand-accent hover:underline">View</button>
                                        <button onClick={() => window.print()} className="text-sm text-brand-accent hover:underline">Print</button>
                                    </div>
                                </li>
                            ))}
                        </ul>
                    </Section>

                    <Section title="Timeline View">
                        <div className="border-l-2 border-brand-accent pl-6 space-y-6">
                             <div>
                                <h4 className="font-semibold text-lg text-slate-800 dark:text-slate-200">2024</h4>
                                <div className="ml-4 mt-2 space-y-4">
                                    <div className="relative">
                                        <div className="absolute -left-8 top-1.5 h-3 w-3 bg-brand-primary rounded-full"></div>
                                        <p className="font-semibold">October</p>
                                        <p className="text-sm ml-4">- 15: Consultation at Apollo (Blood Test Ordered)</p>
                                    </div>
                                    <div className="relative">
                                        <div className="absolute -left-8 top-1.5 h-3 w-3 bg-brand-primary rounded-full"></div>
                                        <p className="font-semibold">September</p>
                                        <p className="text-sm ml-4">- 28: Follow-up at City Hospital (CT Scan Prescribed)</p>
                                    </div>
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