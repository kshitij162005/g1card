
import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import Card from '../../components/Card';
import { StaffRole } from '../../types';
import { useAuth } from '../../contexts/AuthContext';

interface FormState { name: string; email: string; role: string; phone: string }

const AddStaffPage: React.FC = () => {
    const navigate = useNavigate();
    const { user } = useAuth();
    const [form, setForm] = useState<FormState>({ name: '', email: '', role: StaffRole.ADMIN, phone: '' });
    const [loading, setLoading] = useState(false);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!user) return alert('Not authenticated');
        setLoading(true);
        try {
            const resp = await fetch(`http://localhost:8082/api/hospitals/${user.id}/staff`, {
                method: 'POST', headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(form),
            });
            const data = await resp.json();
            if (!resp.ok) throw new Error(data.error || 'Failed to add staff');
            alert('New staff member added successfully! ID: ' + (data.staff?.staffId || ''));
            navigate('/hospital/staff');
        } catch (err: any) {
            console.error(err);
            alert('Error: ' + (err.message || String(err)));
        } finally { setLoading(false); }
    };

    return (
        <div className="space-y-6">
             <div className="flex justify-between items-center">
                <h2 className="text-2xl font-bold text-gray-800">Add New Staff Member</h2>
                <button onClick={() => navigate(-1)} className="px-4 py-2 bg-gray-200 text-gray-800 text-sm rounded-md hover:bg-gray-300">
                    &larr; Back
                </button>
            </div>
            <Card>
                <form onSubmit={handleSubmit} className="p-4 space-y-4">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div>
                            <label htmlFor="staffName" className="block text-sm font-medium text-gray-700">Full Name</label>
                            <input type="text" id="staffName" value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} className="mt-1 block w-full border border-slate-300 rounded-md shadow-sm py-2 px-3 bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100 placeholder:text-slate-400 dark:placeholder:text-slate-500" required />
                        </div>
                        <div>
                            <label htmlFor="staffEmail" className="block text-sm font-medium text-gray-700">Email Address</label>
                            <input type="email" id="staffEmail" value={form.email} onChange={e => setForm(f => ({ ...f, email: e.target.value }))} className="mt-1 block w-full border border-slate-300 rounded-md shadow-sm py-2 px-3 bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100 placeholder:text-slate-400 dark:placeholder:text-slate-500" required />
                        </div>
                        <div>
                            <label htmlFor="staffRole" className="block text-sm font-medium text-gray-700">Role</label>
                            <select id="staffRole" value={form.role} onChange={e => setForm(f => ({ ...f, role: e.target.value }))} className="mt-1 block w-full border border-slate-300 rounded-md shadow-sm py-2 px-3 bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100" required>
                                {Object.values(StaffRole).map(r => <option key={r} value={r}>{r}</option>)}
                            </select>
                        </div>
                    </div>
                    <div>
                        <div>
                            <label htmlFor="staffPhone" className="block text-sm font-medium text-gray-700">Phone</label>
                            <input id="staffPhone" value={form.phone} onChange={e => setForm(f => ({ ...f, phone: e.target.value }))} className="mt-1 block w-full border border-slate-300 rounded-md shadow-sm py-2 px-3 bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100 placeholder:text-slate-400 dark:placeholder:text-slate-500" />
                        </div>
                        <div className="flex justify-end">
                        <button type="submit" disabled={loading} className="px-6 py-2 bg-brand-primary text-white font-semibold rounded-md hover:bg-brand-secondary">
                            {loading ? 'Adding…' : 'Add Staff Member'}
                        </button>
                    </div>
                    </div>
                </form>
            </Card>
        </div>
    );
};

export default AddStaffPage;
