
import React from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import Card from '../../components/Card';
import { DetailedPatient } from '../../types';

const mockPatientData: { [key: string]: DetailedPatient } = {
    'P12345': {
        id: 'P12345',
        name: 'John Doe',
        dob: '15-05-1990',
        age: 34,
        gender: 'Male',
        contact: '+91-9876543210',
        email: 'john@example.com',
        address: 'Mumbai, Maharashtra',
        bloodGroup: 'B+',
        height: "5'10\"",
        weight: '75 kg',
        bmi: '24.5 (Normal)',
        allergies: [
            { name: 'Penicillin', severity: 'Antibiotic' },
            { name: 'Shellfish', severity: 'Food' },
            { name: 'Nuts', severity: 'Food' },
        ],
        chronicConditions: [
            { name: 'Hypertension', diagnosed: '2018' },
            { name: 'Type 2 Diabetes', diagnosed: '2020' },
        ],
        currentMedications: [
            { name: 'Lisinopril 10mg', dosage: 'Once daily', since: '15-Oct-2023', prescribedBy: 'Apollo Hospital' },
            { name: 'Metformin 500mg', dosage: 'Twice daily', since: '20-Sep-2022', prescribedBy: 'City Hospital' },
        ],
        previousSurgeries: [
            { name: 'Appendectomy', date: '10-May-2015', hospital: 'Max Healthcare', doctor: 'Dr. Sharma', treatment: 'Surgical Removal' },
            { name: 'Fractured Left Arm', date: '03-Mar-2019', hospital: 'Fortis Hospital', doctor: 'Dr. Verma', treatment: 'Casting & Physiotherapy' },
        ],
        immunizationRecords: [
            { name: 'COVID-19 (Dose 1)', date: '15-Jan-2021' },
            { name: 'COVID-19 (Dose 2)', date: '12-Feb-2021' },
            { name: 'Influenza', date: '10-Sep-2023' },
            { name: 'Tetanus Booster', date: '05-Jun-2022' },
        ],
        consultationHistory: [
            { date: '15-Oct-2024', hospital: 'Apollo', doctor: 'Dr. P...', reason: 'Checkup' },
            { date: '28-Sep-2024', hospital: 'City Hosp', doctor: 'Dr. R...', reason: 'BP Mgmt' },
            { date: '10-Aug-2024', hospital: 'Apollo', doctor: 'Dr. A...', reason: 'Blood Test' },
        ],
        uploadedDocuments: [
            { name: 'Lab_Report_Oct2024.pdf', date: '15-Oct-2024', type: 'pdf' },
            { name: 'CT_Scan_Result.pdf', date: '28-Sep-2024', type: 'pdf' },
            { name: 'Prescription_Apollo.jpg', date: '10-Aug-2024', type: 'jpg' },
        ],
        lastUpdated: '2 hours ago by Dr. Rajesh',
        created: '20-Mar-2022',
    }
};

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
    const [patient, setPatient] = React.useState<DetailedPatient | null>(null);
    const [loading, setLoading] = React.useState(true);

    React.useEffect(() => {
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
                     <Section title="Current Medications" onAdd={handleAddRecord}>
                        {patient.currentMedications.map((med, index) => (
                            <div key={index} className={`text-sm ${index > 0 ? 'mt-3 pt-3 border-t dark:border-slate-700' : ''}`}>
                                <p className="font-semibold">{med.name} - {med.dosage}</p>
                                <p className="text-xs text-slate-600 dark:text-slate-400">Since: {med.since} | Prescribed by: {med.prescribedBy}</p>
                            </div>
                        ))}
                    </Section>
                     <Section title="Previous Surgeries & Injuries" onAdd={handleAddRecord}>
                        {patient.previousSurgeries.map((item, index) => (
                             <div key={index} className={`text-sm ${index > 0 ? 'mt-3 pt-3 border-t dark:border-slate-700' : ''}`}>
                                <p className="font-semibold">{item.name} - {item.date}</p>
                                <p className="text-xs text-slate-600 dark:text-slate-400">Hospital: {item.hospital} | Doctor: {item.doctor}</p>
                                <p className="text-xs text-slate-600 dark:text-slate-400">Treatment: {item.treatment}</p>
                            </div>
                        ))}
                    </Section>
                    <Section title="Immunization Records" onAdd={handleAddRecord}>
                        <ul className="list-disc list-inside text-sm grid grid-cols-2 gap-x-4 gap-y-1">
                            {patient.immunizationRecords.map(item => <li key={item.name}>{item.name} - {item.date}</li>)}
                        </ul>
                    </Section>
                    <Section title="Consultation History" onAdd={handleAddRecord}>
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
                     <Section title="Uploaded Medical Documents" onAdd={handleAddRecord}>
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
        </div>
    );
};

export default PatientRecord;