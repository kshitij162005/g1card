
import React from 'react';
import { useNavigate } from 'react-router-dom';
import Card from '../../components/Card';

const AddHospitalPage: React.FC = () => {
    const navigate = useNavigate();

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        notify('New hospital added successfully!');
        navigate('/admin/hospitals');
    };

    return (
        <div className="space-y-6">
             <div className="flex justify-between items-center">
                <div>
                    <h2 className="text-2xl font-bold text-slate-900 dark:text-slate-100">Register New Hospital</h2>
                    <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">Create a hospital account and assign an administrator.</p>
                </div>
                <button type="button" onClick={() => navigate(-1)} className="px-4 py-2 bg-slate-200 dark:bg-slate-700 text-slate-800 dark:text-slate-200 text-sm rounded-lg hover:bg-slate-300 dark:hover:bg-slate-600">
                    &larr; Back
                </button>
            </div>
            <Card className="max-w-3xl">
                <form onSubmit={handleSubmit} className="space-y-5">
                    <div>
                        <label htmlFor="hospitalName" className="block text-sm font-medium text-slate-700 dark:text-slate-300">Hospital Name</label>
                        <input type="text" id="hospitalName" className="mt-1 block w-full border border-slate-300 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 py-2.5 px-3 focus:outline-none focus:ring-brand-accent focus:border-brand-accent" required />
                    </div>
                    <div>
                        <label htmlFor="location" className="block text-sm font-medium text-slate-700 dark:text-slate-300">Location</label>
                        <input type="text" id="location" className="mt-1 block w-full border border-slate-300 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 py-2.5 px-3 focus:outline-none focus:ring-brand-accent focus:border-brand-accent" required />
                    </div>
                    <div>
                        <label htmlFor="adminEmail" className="block text-sm font-medium text-slate-700 dark:text-slate-300">Administrator Email</label>
                        <input type="email" id="adminEmail" className="mt-1 block w-full border border-slate-300 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 py-2.5 px-3 focus:outline-none focus:ring-brand-accent focus:border-brand-accent" required />
                    </div>
                    <div className="flex justify-end">
                        <button type="submit" className="px-6 py-2.5 bg-brand-primary text-white font-semibold rounded-lg hover:bg-brand-secondary shadow-sm hover:shadow-md transition-all">
                            Add Hospital
                        </button>
                    </div>
                </form>
            </Card>
        </div>
    );
};

export default AddHospitalPage;
