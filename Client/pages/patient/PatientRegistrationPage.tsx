import { API_URL } from '../../config/api';

import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';

const FormInput: React.FC<{ label: string; id: string; type?: string; placeholder?: string; required?: boolean }> = (props) => (
    <div>
        <label htmlFor={props.id} className="block text-sm font-medium text-slate-700 dark:text-slate-300">{props.label}</label>
        <input {...props} className="mt-1 block w-full px-3 py-2 border border-slate-300 dark:border-slate-600 rounded-lg shadow-sm focus:outline-none focus:ring-brand-accent focus:border-brand-accent sm:text-sm bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100 placeholder:text-slate-400 dark:placeholder:text-slate-500" />
    </div>
);

const RadioGroup: React.FC<{ legend: string; name: string; options: string[]; value?: string; onChange?: (v:string)=>void }> = ({ legend, name, options, value, onChange }) => (
    <div>
        <span className="block text-sm font-medium text-slate-700 dark:text-slate-300">{legend}</span>
        <div className="mt-2 flex flex-wrap gap-4">
            {options.map(option => (
                <label key={option} className="flex items-center space-x-2">
                    <input type="radio" name={name} value={option} checked={value===option} onChange={(e)=>onChange?.(e.target.value)} className="form-radio h-4 w-4 text-brand-accent transition duration-150 ease-in-out" />
                    <span className="text-slate-700 dark:text-slate-300">{option}</span>
                </label>
            ))}
        </div>
    </div>
);

const PatientRegistrationPage: React.FC = () => {
    const [step, setStep] = useState(1);
    const [files, setFiles] = useState<File[]>([]);
    const navigate = useNavigate();

    // Controlled form state so inputs persist across steps
    const [form, setForm] = useState({
        firstName: '', lastName: '', email: '', dob: '', gender: '', phone: '', address: '', emergencyContactName: '', emergencyContactPhone: '',
        allergies: '', conditions: '', surgeries: '', medications: '', familyHistory: '', smoking: '',
        password: '', confirmPassword: ''
    });
    const update = (k: string, v: any) => setForm(prev => ({ ...prev, [k]: v }));

    const nextStep = () => setStep(prev => prev + 1);
    const prevStep = () => setStep(prev => prev - 1);

    const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        if (e.target.files) {
            setFiles(prev => [...prev, ...Array.from(e.target.files!)]);
        }
    };

    const removeFile = (fileName: string) => {
        setFiles(prev => prev.filter(file => file.name !== fileName));
    };
    
    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();

        const { email, password, confirmPassword, firstName, lastName, dob, gender, phone, address, emergencyContactName, emergencyContactPhone } = form;
        if (!email || !password) {
            notify('Email and password required');
            return;
        }
        if (password !== confirmPassword) {
            notify('Passwords do not match');
            return;
        }

        // Convert comma-separated text fields into arrays for the backend schema
        const toArray = (val?: string) => (val ? val.split(',').map(s => s.trim()).filter(Boolean) : []);

        const body = {
            email,
            password,
            firstName,
            lastName,
            dob,
            gender,
            phone,
            address,
            emergencyContactName,
            emergencyContactPhone,
            allergies: toArray(form.allergies),
            conditions: toArray(form.conditions),
            surgeries: toArray(form.surgeries),
            medications: toArray(form.medications),
            familyHistory: form.familyHistory,
            smoking: form.smoking,
        };

        try {
            const resp = await fetch(`${API_URL}/auth/signup/patient`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(body),
            });
            const data = await resp.json();
            if (!resp.ok) {
                notify('Registration failed: ' + (data?.error || data?.message || 'unknown'));
                return;
            }
            // After registration go to login (OTP removed)
            notify('Registration successful — please login');
            navigate('/login');
        } catch (err) {
            console.error('patient signup error', err);
            notify('Registration error');
        }
    };

    return (
        <div className="min-h-screen bg-slate-100 dark:bg-slate-900 py-12 px-4 sm:px-6 lg:px-8">
            <div className="max-w-3xl mx-auto bg-white dark:bg-slate-800 rounded-2xl shadow-xl overflow-hidden">
                <div className="p-8">
                    <div className="text-center mb-8">
                        <h1 className="text-2xl font-bold text-brand-primary dark:text-white">Patient Registration</h1>
                        <p className="text-slate-500 dark:text-slate-400">Create Your Health Profile on G1CARD</p>
                        <div className="w-full bg-slate-200 dark:bg-slate-700 rounded-full h-2.5 mt-4">
                            <div className="bg-brand-accent h-2.5 rounded-full" style={{ width: `${(step / 4) * 100}%` }}></div>
                        </div>
                         <p className="text-sm font-semibold mt-2 text-slate-600 dark:text-slate-400">Step {step} of 4</p>
                    </div>

                    <form onSubmit={handleSubmit}>
                        {step === 1 && (
                            <div className="space-y-4">
                                <h3 className="text-lg font-medium leading-6 text-slate-900 dark:text-slate-200">Personal Information</h3>
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                    <FormInput id="firstName" label="First Name" required value={form.firstName} onChange={(e)=>update('firstName', e.target.value)} />
                                    <FormInput id="lastName" label="Last Name" required value={form.lastName} onChange={(e)=>update('lastName', e.target.value)} />
                                </div>
                                <FormInput id="email" label="Email" type="email" required value={form.email} onChange={(e)=>update('email', e.target.value)} />
                                <FormInput id="dob" label="Date of Birth" type="date" required value={form.dob} onChange={(e)=>update('dob', e.target.value)} />
                                <RadioGroup legend="Gender" name="gender" options={['Male', 'Female', 'Other', 'Prefer Not']} value={form.gender} onChange={(v)=>update('gender', v)} />
                                <FormInput id="phone" label="Phone Number" type="tel" placeholder="+91-..." required value={form.phone} onChange={(e)=>update('phone', e.target.value)} />
                                <FormInput id="address" label="Address" required value={form.address} onChange={(e)=>update('address', e.target.value)} />
                                <FormInput id="emergencyContactName" label="Emergency Contact Name" required value={form.emergencyContactName} onChange={(e)=>update('emergencyContactName', e.target.value)} />
                                <FormInput id="emergencyContactPhone" label="Emergency Contact Phone" type="tel" required value={form.emergencyContactPhone} onChange={(e)=>update('emergencyContactPhone', e.target.value)} />
                            </div>
                        )}

                        {step === 2 && (
                            <div className="space-y-4">
                                <h3 className="text-lg font-medium leading-6 text-slate-900 dark:text-slate-200">Medical History</h3>
                                <FormInput id="allergies" label="Known Allergies" placeholder="e.g., Penicillin, Nuts, Shellfish" value={form.allergies} onChange={(e)=>update('allergies', e.target.value)} />
                                <FormInput id="conditions" label="Chronic Conditions" placeholder="e.g., Diabetes, Hypertension, Asthma" value={form.conditions} onChange={(e)=>update('conditions', e.target.value)} />
                                <FormInput id="surgeries" label="Previous Surgeries/Injuries" placeholder="e.g., Appendectomy (2015), Fracture (2019)" value={form.surgeries} onChange={(e)=>update('surgeries', e.target.value)} />
                                <FormInput id="medications" label="Current Medications" placeholder="e.g., Aspirin 100mg daily" value={form.medications} onChange={(e)=>update('medications', e.target.value)} />
                                <div>
                                    <label htmlFor="familyHistory" className="block text-sm font-medium text-slate-700 dark:text-slate-300">Family Medical History</label>
                                    <textarea id="familyHistory" rows={3} value={form.familyHistory} onChange={(e)=>update('familyHistory', e.target.value)} className="mt-1 block w-full px-3 py-2 border border-slate-300 dark:border-slate-600 rounded-lg shadow-sm focus:outline-none focus:ring-brand-accent focus:border-brand-accent bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100 placeholder:text-slate-400 dark:placeholder:text-slate-500" placeholder="Describe any hereditary conditions or significant family illnesses"></textarea>
                                </div>
                                <RadioGroup legend="Smoking" name="smoking" options={['Never', 'Former', 'Current']} value={form.smoking} onChange={(v)=>update('smoking', v)} />
                            </div>
                        )}

                        {step === 3 && (
                             <div className="space-y-4">
                                <h3 className="text-lg font-medium leading-6 text-slate-900 dark:text-slate-200">Upload Medical Documents</h3>
                                <p className="text-sm text-slate-500 dark:text-slate-400">Upload previous prescriptions, lab reports, etc. (Max 100MB total)</p>
                                <div className="mt-1 flex justify-center px-6 pt-5 pb-6 border-2 border-slate-300 dark:border-slate-600 border-dashed rounded-lg">
                                    <div className="space-y-1 text-center">
                                        <svg className="mx-auto h-12 w-12 text-slate-400" stroke="currentColor" fill="none" viewBox="0 0 48 48" aria-hidden="true"><path d="M28 8H12a4 4 0 00-4 4v20m32-12v8m0 0v8a4 4 0 01-4 4H12a4 4 0 01-4-4v-4m32-4l-3.172-3.172a4 4 0 00-5.656 0L28 28M8 32l9.172-9.172a4 4 0 015.656 0L28 28m0 0l4 4m4-24h8m-4-4v8" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" /></svg>
                                        <div className="flex text-sm text-slate-600 dark:text-slate-400">
                                            <label htmlFor="file-upload" className="relative cursor-pointer bg-white dark:bg-slate-800 rounded-md font-medium text-brand-primary hover:text-brand-secondary focus-within:outline-none focus-within:ring-2 focus-within:ring-offset-2 focus-within:ring-brand-accent">
                                                <span>Upload files</span>
                                                <input id="file-upload" name="file-upload" type="file" className="sr-only" multiple onChange={handleFileChange} />
                                            </label>
                                            <p className="pl-1">or drag and drop</p>
                                        </div>
                                        <p className="text-xs text-slate-500 dark:text-slate-500">PDF, JPG, PNG up to 25MB each</p>
                                    </div>
                                </div>
                                {files.length > 0 && (
                                    <div className="pt-4">
                                        <h4 className="text-sm font-medium text-slate-800 dark:text-slate-200">Selected Files:</h4>
                                        <ul className="mt-2 border border-slate-200 dark:border-slate-700 rounded-lg divide-y divide-slate-200 dark:divide-slate-700">
                                            {files.map(file => (
                                                <li key={file.name} className="pl-3 pr-4 py-3 flex items-center justify-between text-sm">
                                                    <div className="w-0 flex-1 flex items-center">
                                                        <span className="ml-2 flex-1 w-0 truncate text-slate-800 dark:text-slate-300">{file.name}</span>
                                                        <span className="ml-2 text-slate-500 dark:text-slate-400">{(file.size / 1024 / 1024).toFixed(2)} MB</span>
                                                    </div>
                                                    <div className="ml-4 flex-shrink-0">
                                                        <button type="button" onClick={() => removeFile(file.name)} className="font-medium text-red-600 hover:text-red-500">Remove</button>
                                                    </div>
                                                </li>
                                            ))}
                                        </ul>
                                    </div>
                                )}
                            </div>
                        )}
                        
                        {step === 4 && (
                            <div className="space-y-6">
                                 <h3 className="text-lg font-medium leading-6 text-slate-900 dark:text-slate-200">Consent & Agreement</h3>
                                 <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                     <FormInput id="password" label="Password" type="password" required value={form.password} onChange={(e)=>update('password', e.target.value)} />
                                     <FormInput id="confirmPassword" label="Confirm Password" type="password" required value={form.confirmPassword} onChange={(e)=>update('confirmPassword', e.target.value)} />
                                 </div>
                                 <div className="flex items-start">
                                     <input id="terms" type="checkbox" className="h-4 w-4 text-brand-accent border-slate-300 rounded mt-1 focus:ring-brand-accent" required />
                                     <label htmlFor="terms" className="ml-3 block text-sm text-slate-900 dark:text-slate-300">I agree to G1CARD Terms of Service.</label>
                                 </div>
                                 <div className="flex items-start">
                                     <input id="certify" type="checkbox" className="h-4 w-4 text-brand-accent border-slate-300 rounded mt-1 focus:ring-brand-accent" required />
                                     <label htmlFor="certify" className="ml-3 block text-sm text-slate-900 dark:text-slate-300">I certify all information is accurate.</label>
                                 </div>
                                 <div className="flex items-start">
                                     <input id="authorize" type="checkbox" className="h-4 w-4 text-brand-accent border-slate-300 rounded mt-1 focus:ring-brand-accent" required />
                                     <label htmlFor="authorize" className="ml-3 block text-sm text-slate-900 dark:text-slate-300">I authorize hospitals to access my medical records for treatment purposes.</label>
                                 </div>
                                 <div className="flex items-start">
                                     <input id="hipaa" type="checkbox" className="h-4 w-4 text-brand-accent border-slate-300 rounded mt-1 focus:ring-brand-accent" required />
                                     <label htmlFor="hipaa" className="ml-3 block text-sm text-slate-900 dark:text-slate-300">I understand my data is encrypted and HIPAA compliant.</label>
                                 </div>
                            </div>
                        )}
                        
                        <div className="mt-8 flex justify-between">
                            {step > 1 ? (
                                <button type="button" onClick={prevStep} className="px-6 py-2 border border-slate-300 dark:border-slate-600 rounded-lg shadow-sm text-sm font-medium text-slate-700 dark:text-slate-200 bg-white dark:bg-slate-700 hover:bg-slate-50 dark:hover:bg-slate-600">
                                    Previous
                                </button>
                            ) : <div></div>}
                             {step < 4 && (
                                <button type="button" onClick={nextStep} className="ml-auto px-6 py-2 border border-transparent rounded-lg shadow-sm text-sm font-medium text-white bg-brand-primary hover:bg-brand-secondary">
                                    Next
                                </button>
                            )}
                            {step === 4 && (
                                <button type="submit" className="ml-auto px-6 py-2 border border-transparent rounded-lg shadow-sm text-sm font-medium text-white bg-brand-primary hover:bg-brand-secondary">
                                    Register
                                </button>
                            )}
                        </div>
                    </form>
                </div>
            </div>
        </div>
    );
};

export default PatientRegistrationPage;