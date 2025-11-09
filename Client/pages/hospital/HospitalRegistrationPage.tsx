
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

    const nextStep = () => setStep(prev => prev + 1);
    const prevStep = () => setStep(prev => prev - 1);
    
    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        navigate('/hospital/verify-otp');
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
                                <FormInput id="hospitalName" label="Hospital Name" required />
                                <FormInput id="regNumber" label="Hospital Registration Number" required />
                                <FormInput id="address" label="Address" required />
                                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                                    <FormInput id="city" label="City" required />
                                    <FormInput id="state" label="State" required />
                                    <FormInput id="pin" label="PIN Code" required />
                                </div>
                                <FormInput id="license" label="License Number" required />
                                <FormInput id="email" label="Contact Email" type="email" required />
                                <FormInput id="phone" label="Contact Phone" type="tel" required />
                                <FormInput id="website" label="Website (Optional)" />
                            </div>
                        )}

                        {step === 2 && (
                            <div className="space-y-4">
                                <h3 className="text-lg font-medium leading-6 text-slate-900 dark:text-slate-200">Administrator Details</h3>
                                <FormInput id="adminName" label="Admin Full Name" required />
                                <FormInput id="adminEmail" label="Admin Email" type="email" required />
                                <FormInput id="adminPhone" label="Admin Phone" type="tel" required />
                                <div>
                                    <label htmlFor="designation" className="block text-sm font-medium text-slate-700 dark:text-slate-300">Designation</label>
                                    <select id="designation" className="mt-1 block w-full px-3 py-2 border border-slate-300 bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100 dark:border-slate-600 rounded-lg shadow-sm focus:outline-none focus:ring-brand-accent focus:border-brand-accent sm:text-sm">
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
                                    <input type="file" className="block w-full text-sm text-slate-500 file:mr-4 file:py-2 file:px-4 file:rounded-lg file:border-0 file:text-sm file:font-semibold file:bg-brand-light dark:file:bg-slate-700 file:text-brand-primary dark:file:text-slate-200 hover:file:bg-blue-200 dark:hover:file:bg-slate-600" required/>
                                </div>
                                 <div className="space-y-2">
                                    <label className="block text-sm font-medium text-slate-700 dark:text-slate-300">Registration Certificate (PDF)</label>
                                    <input type="file" className="block w-full text-sm text-slate-500 file:mr-4 file:py-2 file:px-4 file:rounded-lg file:border-0 file:text-sm file:font-semibold file:bg-brand-light dark:file:bg-slate-700 file:text-brand-primary dark:file:text-slate-200 hover:file:bg-blue-200 dark:hover:file:bg-slate-600" required/>
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
                                    Register & Send OTP
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