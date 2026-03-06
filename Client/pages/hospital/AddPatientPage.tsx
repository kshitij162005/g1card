import { API_URL } from '../../config/api';

import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import Card from '../../components/Card';
import { useAuth } from '../../contexts/AuthContext';

interface PatientForm { email: string; password: string }

const AddPatientPage: React.FC = () => {
    const navigate = useNavigate();
    const { user } = useAuth();
    const [form, setForm] = useState<PatientForm>({ email: '', password: '' });
    const [loading, setLoading] = useState(false);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!user) return alert('Not authenticated');
        setLoading(true);
        try {
            const resp = await fetch(`${API_URL}/hospitals/${user.id}/patients`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ email: form.email, password: form.password }) });
            const data = await resp.json();
            if (!resp.ok) throw new Error(data.error || 'Failed to send access request');
            alert('Access request sent to patient. Status: ' + (data.accessRequest?.status || 'PENDING'));
            navigate('/hospital/patients');
        } catch (err: any) {
            console.error(err);
            alert('Error: ' + (err.message || String(err)));
        } finally { setLoading(false); }
    };

    return (
        <div className="space-y-6">
            <div className="flex justify-between items-center">
                <h2 className="text-2xl font-bold text-gray-800 dark:text-slate-100">Add New Patient</h2>
                <button onClick={() => navigate(-1)} className="px-4 py-2 bg-gray-200 dark:bg-slate-700 text-gray-800 dark:text-slate-100 text-sm rounded-md hover:bg-gray-300 dark:hover:bg-slate-600">
                    &larr; Back
                </button>
            </div>
            <Card>
                <form onSubmit={handleSubmit} className="p-4 space-y-4">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div>
                            <label htmlFor="email" className="block text-sm font-medium text-slate-700 dark:text-slate-300">Patient Email</label>
                            <input id="email" value={form.email} onChange={e => setForm(f => ({ ...f, email: e.target.value }))} className="mt-1 block w-full border border-slate-300 dark:border-slate-600 rounded-md shadow-sm py-2 px-3 bg-white dark:bg-slate-700 text-slate-900 dark:text-slate-100 placeholder:text-slate-400 dark:placeholder:text-slate-400" required />
                        </div>
                        <div>
                            <label htmlFor="password" className="block text-sm font-medium text-slate-700 dark:text-slate-300">Patient Password</label>
                            <input id="password" type="password" value={form.password} onChange={e => setForm(f => ({ ...f, password: e.target.value }))} className="mt-1 block w-full border border-slate-300 dark:border-slate-600 rounded-md shadow-sm py-2 px-3 bg-white dark:bg-slate-700 text-slate-900 dark:text-slate-100 placeholder:text-slate-400 dark:placeholder:text-slate-400" required />
                        </div>
                    </div>
                    <div className="flex justify-end">
                        <button type="submit" disabled={loading} className="px-6 py-2 bg-brand-primary text-white font-semibold rounded-md hover:bg-brand-secondary">
                            {loading ? 'Adding…' : 'Add Patient'}
                        </button>
                    </div>
                </form>
            </Card>
        </div>
    );
};

export default AddPatientPage;
