import React, { useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import Card from '../../components/Card';

const FormInput: React.FC<{ label: string; id: string; type?: string; placeholder?: string; value?: string; onChange?: (e: React.ChangeEvent<HTMLInputElement>) => void; }> = (props) => (
    <div>
        <label htmlFor={props.id} className="block text-sm font-medium text-slate-700 dark:text-slate-300">{props.label}</label>
        <input {...props} className="mt-1 block w-full px-3 py-2 border border-slate-300 dark:border-slate-600 rounded-lg shadow-sm focus:outline-none focus:ring-brand-accent focus:border-brand-accent sm:text-sm" />
    </div>
);

const RadioGroup: React.FC<{ legend: string; name: string; options: string[] }> = ({ legend, name, options }) => (
    <div>
        <span className="block text-sm font-medium text-slate-700 dark:text-slate-300">{legend}</span>
        <div className="mt-2 flex flex-wrap gap-x-6 gap-y-2">
            {options.map(option => (
                <label key={option} className="flex items-center space-x-2">
                    <input type="radio" name={name} value={option} className="form-radio h-4 w-4 text-brand-accent transition duration-150 ease-in-out" />
                    <span className="text-slate-700 dark:text-slate-300">{option}</span>
                </label>
            ))}
        </div>
    </div>
);

interface Medicine {
    name: string;
    dosage: string;
    frequency: string;
    duration: string;
}

const AddEditMedicalRecord: React.FC = () => {
    const { patientId } = useParams<{ patientId: string }>();
    const navigate = useNavigate();
    const [medicines, setMedicines] = useState<Medicine[]>([{ name: '', dosage: '', frequency: '', duration: '' }]);

    const handleAddMedicine = () => {
        setMedicines([...medicines, { name: '', dosage: '', frequency: '', duration: '' }]);
    };
    
    const handleMedicineChange = (index: number, field: keyof Medicine, value: string) => {
        const newMedicines = [...medicines];
        newMedicines[index][field] = value;
        setMedicines(newMedicines);
    };

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        alert(`Record submitted for patient ${patientId}.`);
        navigate(`/hospital/patients/${patientId}`);
    }

    return (
        <div className="space-y-6">
            <div className="flex justify-between items-center">
                 <h2 className="text-2xl font-bold text-slate-800 dark:text-slate-200">Add New Medical Record - John Doe ({patientId})</h2>
                <button onClick={() => navigate(-1)} className="px-4 py-2 bg-slate-200 text-slate-800 text-sm rounded-lg hover:bg-slate-300 dark:bg-slate-700 dark:text-slate-200 dark:hover:bg-slate-600">
                    &larr; Back to Patient Record
                </button>
            </div>
            <Card>
                <form onSubmit={handleSubmit} className="space-y-8 divide-y divide-slate-200 dark:divide-slate-700">
                    {/* Record Type Section */}
                    <div className="space-y-4">
                        <h3 className="text-lg font-medium text-slate-900 dark:text-slate-200">Record Type</h3>
                        <RadioGroup legend="" name="recordType" options={['Consultation', 'Diagnosis', 'Treatment', 'Lab Test', 'Procedure', 'Follow-up']} />
                    </div>

                    {/* Consultation Details Section */}
                    <div className="pt-8 space-y-4">
                        <h3 className="text-lg font-medium text-slate-900 dark:text-slate-200">Consultation Details</h3>
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                           <FormInput label="Date of Visit" id="dateOfVisit" type="date" />
                           <FormInput label="Doctor Name" id="doctorName" />
                           <div>
                                <label htmlFor="department" className="block text-sm font-medium text-slate-700 dark:text-slate-300">Department</label>
                                <select id="department" className="mt-1 block w-full pl-3 pr-10 py-2 text-base border-slate-300 dark:border-slate-600 focus:outline-none focus:ring-brand-accent focus:border-brand-accent sm:text-sm rounded-lg">
                                    <option>General</option>
                                    <option>Cardiology</option>
                                    <option>Neurology</option>
                                </select>
                           </div>
                        </div>
                        <FormInput label="Chief Complaint" id="chiefComplaint" />
                         <div>
                            <label htmlFor="consultationNotes" className="block text-sm font-medium text-slate-700 dark:text-slate-300">Consultation Notes</label>
                            <textarea id="consultationNotes" rows={4} maxLength={500} className="mt-1 block w-full px-3 py-2 border border-slate-300 dark:border-slate-600 rounded-lg shadow-sm focus:outline-none focus:ring-brand-accent focus:border-brand-accent" placeholder="Free text area - 500 chars max"></textarea>
                        </div>
                    </div>
                    
                    {/* Vitals Section */}
                    <div className="pt-8 space-y-4">
                         <h3 className="text-lg font-medium text-slate-900 dark:text-slate-200">Vital Signs</h3>
                         <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
                            <FormInput label="BP (mmHg)" id="bp" />
                            <FormInput label="HR (bpm)" id="hr" />
                            <FormInput label="Temp (°C)" id="temp" />
                            <FormInput label="RR (breaths/min)" id="rr" />
                            <FormInput label="O2 (%)" id="o2" />
                         </div>
                    </div>

                    {/* Diagnosis & Medicines Section */}
                    <div className="pt-8 space-y-6">
                         <h3 className="text-lg font-medium text-slate-900 dark:text-slate-200">Diagnosis and Prescription</h3>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                            <FormInput label="Diagnosis" id="diagnosis" />
                            <FormInput label="Diagnosis Code (ICD-10)" id="icd10" />
                        </div>
                        <div>
                            <h4 className="text-md font-medium text-slate-800 dark:text-slate-200 mb-2">Prescribed Medicines</h4>
                            {medicines.map((med, index) => (
                                <div key={index} className="grid grid-cols-1 md:grid-cols-4 gap-4 p-4 mb-4 border dark:border-slate-700 rounded-lg bg-slate-50 dark:bg-slate-700/50">
                                    <FormInput label="Medicine" id={`med-name-${index}`} value={med.name} onChange={(e) => handleMedicineChange(index, 'name', e.target.value)} />
                                    <FormInput label="Dosage" id={`med-dosage-${index}`} value={med.dosage} onChange={(e) => handleMedicineChange(index, 'dosage', e.target.value)} />
                                    <FormInput label="Frequency" id={`med-freq-${index}`} value={med.frequency} onChange={(e) => handleMedicineChange(index, 'frequency', e.target.value)} />
                                    <FormInput label="Duration (days)" id={`med-duration-${index}`} type="number" value={med.duration} onChange={(e) => handleMedicineChange(index, 'duration', e.target.value)} />
                                </div>
                            ))}
                            <button type="button" onClick={handleAddMedicine} className="text-sm px-4 py-2 border border-dashed border-slate-400 dark:border-slate-600 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300">
                                + Add More
                            </button>
                        </div>
                    </div>

                    {/* Follow-up & Attachments Section */}
                    <div className="pt-8 space-y-6">
                         <h3 className="text-lg font-medium text-slate-900 dark:text-slate-200">Follow-up & Attachments</h3>
                         <FormInput label="Referral (if any)" id="referral" placeholder="Referred to: Department/Hospital" />
                         <RadioGroup legend="Follow-up Required" name="followUp" options={['Yes', 'No']} />
                         <div>
                            <label htmlFor="attachments" className="block text-sm font-medium text-slate-700 dark:text-slate-300">Attachments</label>
                            <div className="mt-1">
                                <input type="file" id="attachments" className="block w-full text-sm text-slate-500 file:mr-4 file:py-2 file:px-4 file:rounded-lg file:border-0 file:text-sm file:font-semibold file:bg-brand-light dark:file:bg-slate-700 file:text-brand-primary dark:file:text-slate-200 hover:file:bg-blue-200 dark:hover:file:bg-slate-600"/>
                                <p className="text-xs text-slate-500 mt-1">Supported: PDF, JPG, PNG (Max 25MB)</p>
                            </div>
                         </div>
                    </div>

                    {/* Action Buttons */}
                    <div className="pt-8 flex justify-end space-x-4">
                        <button type="button" onClick={() => navigate(-1)} className="px-6 py-2 border border-slate-300 dark:border-slate-600 rounded-lg shadow-sm text-sm font-medium text-slate-700 dark:text-slate-200 bg-white dark:bg-transparent hover:bg-slate-50 dark:hover:bg-slate-700">
                            Cancel
                        </button>
                         <button type="button" className="px-6 py-2 border border-transparent rounded-lg shadow-sm text-sm font-medium text-white bg-slate-500 hover:bg-slate-600">
                            Save Draft
                        </button>
                         <button type="submit" className="px-6 py-2 border border-transparent rounded-lg shadow-sm text-sm font-medium text-white bg-brand-primary hover:bg-brand-secondary">
                            Submit & Notify Patient
                        </button>
                    </div>
                </form>
            </Card>
        </div>
    );
};

export default AddEditMedicalRecord;