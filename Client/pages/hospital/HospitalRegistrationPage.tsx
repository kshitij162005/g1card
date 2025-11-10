
import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';

const FormInput: React.FC<{ label: string; id: string; type?: string; placeholder?: string; required?: boolean }> = (props) => (
    <div>
        <label htmlFor={props.id} className="block text-sm font-medium text-slate-700 dark:text-slate-300">{props.label}</label>
        <input {...props} className="mt-1 block w-full px-3 py-2 border border-slate-300 dark:border-slate-600 rounded-lg shadow-sm focus:outline-none focus:ring-brand-accent focus:border-brand-accent sm:text-sm bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100 placeholder:text-slate-400 dark:placeholder:text-slate-500" />
    </div>
);

const HospitalRegistrationPage: React.FC = () => {
    const [step, setStep] = useState(1);
    const navigate = useNavigate();

    // Controlled form state so data persists across steps
    const [form, setForm] = useState({
        hospitalName: '', regNumber: '', address: '', city: '', state: '', pin: '', license: '', email: '', phone: '', website: '',
        adminName: '', adminEmail: '', adminPhone: '', designation: 'CEO', password: '', confirmPassword: ''
    });
    const update = (k:string, v:any) => setForm(prev => ({ ...prev, [k]: v }));

    const nextStep = () => setStep(prev => prev + 1);
    const prevStep = () => setStep(prev => prev - 1);
    
    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();

        // Use controlled form state
        const { hospitalName, regNumber, address, city, state, pin, license, email, phone, website, adminName, adminEmail, adminPhone, designation, password, confirmPassword } = form;

        if (!email || !password || !hospitalName) {
            alert('Hospital name, contact email and password are required');
            return;
        }
        if (password !== confirmPassword) {
            alert('Passwords do not match');
            return;
        }

        const body = { hospitalName, regNumber, address, city, state, pin, license, email, phone, website, adminName, adminEmail, adminPhone, designation, password };

        try {
            const resp = await fetch('http://localhost:8082/api/auth/signup/hospital', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(body),
            });
            const data = await resp.json();
            if (!resp.ok) {
                alert('Registration failed: ' + (data?.error || data?.message || 'unknown'));
                return;
            }
            // After registration go to login (OTP removed)
            alert('Registration successful — please login');
            navigate('/login');
        } catch (err) {
            console.error('hospital signup error', err);
            alert('Registration error');
        }
    };

    return (
        <div className="min-h-screen bg-slate-100 dark:bg-slate-900 py-12 px-4 sm:px-6 lg:px-8">
            <div className="max-w-3xl mx-auto bg-white dark:bg-slate-800 rounded-2xl shadow-xl overflow-hidden">
                <div className="p-8">
                    <div className="text-center mb-8">
                        <h1 className="text-2xl font-bold text-brand-primary dark:text-white">Hospital Registration</h1>
                        <p className="text-slate-500 dark:text-slate-400">Join G1CARD Medical Network</p>
                        <div className="w-full bg-slate-200 dark:bg-slate-700 rounded-full h-2.5 mt-4">
                            <div className="bg-brand-accent h-2.5 rounded-full" style={{ width: `${(step / 4) * 100}%` }}></div>
                        </div>
                         <p className="text-sm font-semibold mt-2 text-slate-600 dark:text-slate-400">Step {step} of 4</p>
                    </div>

                    <form onSubmit={handleSubmit}>
                        {step === 1 && (
                            <div className="space-y-4">
                                <h3 className="text-lg font-medium leading-6 text-slate-900 dark:text-slate-200">Hospital Information</h3>
                                <FormInput id="hospitalName" label="Hospital Name" required value={form.hospitalName} onChange={(e)=>update('hospitalName', e.target.value)} />
                                <FormInput id="regNumber" label="Hospital Registration Number" required value={form.regNumber} onChange={(e)=>update('regNumber', e.target.value)} />
                                <FormInput id="address" label="Address" required value={form.address} onChange={(e)=>update('address', e.target.value)} />
                                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                                    <FormInput id="city" label="City" required value={form.city} onChange={(e)=>update('city', e.target.value)} />
                                    <FormInput id="state" label="State" required value={form.state} onChange={(e)=>update('state', e.target.value)} />
                                    <FormInput id="pin" label="PIN Code" required value={form.pin} onChange={(e)=>update('pin', e.target.value)} />
                                </div>
                                <FormInput id="license" label="License Number" required value={form.license} onChange={(e)=>update('license', e.target.value)} />
                                <FormInput id="email" label="Contact Email" type="email" required value={form.email} onChange={(e)=>update('email', e.target.value)} />
                                <FormInput id="phone" label="Contact Phone" type="tel" required value={form.phone} onChange={(e)=>update('phone', e.target.value)} />
                                <FormInput id="website" label="Website (Optional)" value={form.website} onChange={(e)=>update('website', e.target.value)} />
                            </div>
                        )}

                        {step === 2 && (
                            <div className="space-y-4">
                                <h3 className="text-lg font-medium leading-6 text-slate-900 dark:text-slate-200">Administrator Details</h3>
                                <FormInput id="adminName" label="Admin Full Name" required value={form.adminName} onChange={(e)=>update('adminName', e.target.value)} />
                                <FormInput id="adminEmail" label="Admin Email" type="email" required value={form.adminEmail} onChange={(e)=>update('adminEmail', e.target.value)} />
                                <FormInput id="adminPhone" label="Admin Phone" type="tel" required value={form.adminPhone} onChange={(e)=>update('adminPhone', e.target.value)} />
                                <div>
                                    <label htmlFor="designation" className="block text-sm font-medium text-slate-700 dark:text-slate-300">Designation</label>
                                    <select id="designation" value={form.designation} onChange={(e)=>update('designation', e.target.value)} className="mt-1 block w-full px-3 py-2 border border-slate-300 bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100 dark:border-slate-600 rounded-lg shadow-sm focus:outline-none focus:ring-brand-accent focus:border-brand-accent sm:text-sm">
                                        <option>CEO</option>
                                        <option>COO</option>
                                        <option>Head of Department</option>
                                        <option>Other</option>
                                    </select>
                                </div>
                            </div>
                        )}

                        {step === 3 && (
                             <div className="space-y-4">
                                <h3 className="text-lg font-medium leading-6 text-slate-900 dark:text-slate-200">Documents Upload</h3>
                                <p className="text-sm text-slate-500 dark:text-slate-400">Max file size: 25 MB each. Supported: PDF, JPG, PNG</p>
                                <div className="space-y-2">
                                    <label className="block text-sm font-medium text-slate-700 dark:text-slate-300">Hospital License</label>
                                    <input type="file" className="block w-full text-sm text-slate-500 file:mr-4 file:py-2 file:px-4 file:rounded-lg file:border-0 file:text-sm file:font-semibold file:bg-brand-light dark:file:bg-slate-700 file:text-brand-primary dark:file:text-slate-200 hover:file:bg-blue-200 dark:hover:file:bg-slate-600" />
                                </div>
                                 <div className="space-y-2">
                                    <label className="block text-sm font-medium text-slate-700 dark:text-slate-300">Registration Certificate (PDF)</label>
                                    <input type="file" className="block w-full text-sm text-slate-500 file:mr-4 file:py-2 file:px-4 file:rounded-lg file:border-0 file:text-sm file:font-semibold file:bg-brand-light dark:file:bg-slate-700 file:text-brand-primary dark:file:text-slate-200 hover:file:bg-blue-200 dark:hover:file:bg-slate-600" />
                                </div>
                                <div className="space-y-2">
                                    <label className="block text-sm font-medium text-slate-700 dark:text-slate-300">Tax ID Certificate (Optional)</label>
                                    <input type="file" className="block w-full text-sm text-slate-500 file:mr-4 file:py-2 file:px-4 file:rounded-lg file:border-0 file:text-sm file:font-semibold file:bg-brand-light dark:file:bg-slate-700 file:text-brand-primary dark:file:text-slate-200 hover:file:bg-blue-200 dark:hover:file:bg-slate-600"/>
                                </div>
                            </div>
                        )}

                        {step === 4 && (
                            <div className="space-y-4">
                                 <h3 className="text-lg font-medium leading-6 text-slate-900 dark:text-slate-200">Terms & Conditions</h3>
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                     <FormInput id="password" label="Password" type="password" required value={form.password} onChange={(e)=>update('password', e.target.value)} />
                                     <FormInput id="confirmPassword" label="Confirm Password" type="password" required value={form.confirmPassword} onChange={(e)=>update('confirmPassword', e.target.value)} />
                                 </div>
                                 <div className="flex items-start">
                                     <input id="terms" type="checkbox" className="h-4 w-4 text-brand-accent border-slate-300 rounded mt-1 focus:ring-brand-accent" required />
                                     <label htmlFor="terms" className="ml-2 block text-sm text-slate-900 dark:text-slate-300">I agree to G1CARD Terms of Service.</label>
                                 </div>
                                 <div className="flex items-start">
                                     <input id="certify" type="checkbox" className="h-4 w-4 text-brand-accent border-slate-300 rounded mt-1 focus:ring-brand-accent" required />
                                     <label htmlFor="certify" className="ml-2 block text-sm text-slate-900 dark:text-slate-300">I certify all information is accurate.</label>
                                 </div>
                            </div>
                        )}
                        
                        <div className="mt-8 flex justify-between">
                            {step > 1 && (
                                <button type="button" onClick={prevStep} className="px-6 py-2 border border-slate-300 dark:border-slate-600 rounded-lg shadow-sm text-sm font-medium text-slate-700 dark:text-slate-200 bg-white dark:bg-slate-700 hover:bg-slate-50 dark:hover:bg-slate-600">
                                    Previous
                                </button>
                            )}
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

export default HospitalRegistrationPage;