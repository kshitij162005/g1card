import { API_URL } from '../../config/api';


import React, { useState, useEffect } from 'react';
import Card from '../../components/Card';
import { Staff, StaffRole } from '../../types';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';

interface ApiStaff { _id: string; staffId?: string; name: string; email: string; role?: string; status?: string }

const mockStaff: Staff[] = [
    { id: 's1', name: 'Dr. Raj', email: 'raj@apollo.com', role: StaffRole.DOCTOR, status: 'Active' },
    { id: 's2', name: 'Nurse A', email: 'nursea@apollo.com', role: StaffRole.NURSE, status: 'Active' },
    { id: 's3', name: 'Staff B', email: 'staffb@apollo.com', role: StaffRole.ADMIN, status: 'Active' },
    { id: 's4', name: 'Dr. Emily', email: 'emily@apollo.com', role: StaffRole.DOCTOR, status: 'Inactive' },
];

const StaffManagement: React.FC = () => {
    const [staff, setStaff] = useState<Staff[]>([]);
    const [searchTerm, setSearchTerm] = useState('');
    const [page, setPage] = useState(1);
    const [total, setTotal] = useState(0);
    const [loading, setLoading] = useState(false);
    const { user } = useAuth();

    useEffect(() => { fetchStaff(); }, []);

    const fetchStaff = async (q = '', pageArg = page) => {
        if (!user) return;
        setLoading(true);
        try {
            const resp = await fetch(`${API_URL}/hospitals/${user.id}/staff?q=${encodeURIComponent(q)}&page=${pageArg}&limit=10`);
            const data = await resp.json();
            if (!resp.ok) throw new Error(data.error || 'Failed');
            const items: ApiStaff[] = data.staff || [];
            setTotal(data.total || 0);
            // map to UI Staff type
            setStaff(items.map(it => ({ id: it.staffId || it._id, name: it.name, email: it.email, role: (it.role || 'Admin') as StaffRole, status: (it.status || 'Active') as 'Active' | 'Inactive' })));
        } catch (err) {
            console.error('fetch staff', err);
        } finally { setLoading(false); }
    };
    const [filterRole, setFilterRole] = useState<StaffRole | 'All'>('All');
    const navigate = useNavigate();

    // server provides search results; only apply role filter on the client
    const filteredStaff = staff.filter(s => filterRole === 'All' || s.role === filterRole);

    // debounce search
    const searchTimer = React.useRef<number | null>(null);
    
    const getStatusChip = (status: 'Active' | 'Inactive') => {
        return status === 'Active' ? 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200' : 'bg-slate-100 text-slate-800 dark:bg-slate-700 dark:text-slate-300';
    };

    return (
        <Card title="Staff Management">
            <div className="space-y-4">
                 <div className="flex flex-col md:flex-row justify-between md:items-center gap-4">
                    <input
                        type="text"
                        placeholder="Search staff..."
                        className="w-full md:w-1/3 px-3 py-2 border border-slate-300 dark:border-slate-600 rounded-lg focus:ring-brand-accent focus:border-brand-accent bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 placeholder:text-slate-400 dark:placeholder:text-slate-400"
                        value={searchTerm}
                        onChange={e => {
                            const v = e.target.value;
                            setSearchTerm(v);
                            // debounce server call and reset to page 1
                            if (searchTimer.current) window.clearTimeout(searchTimer.current);
                            // eslint-disable-next-line @typescript-eslint/ban-ts-comment
                            // @ts-ignore
                            searchTimer.current = window.setTimeout(() => {
                                setPage(1);
                                fetchStaff(v, 1);
                            }, 300);
                        }}
                    />
                    <select
                        className="w-full md:w-1/4 px-3 py-2 border border-slate-300 dark:border-slate-600 rounded-lg focus:ring-brand-accent focus:border-brand-accent bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100"
                        value={filterRole}
                        onChange={e => setFilterRole(e.target.value as StaffRole | 'All')}
                    >
                        <option value="All">All Roles</option>
                        {Object.values(StaffRole).map(r => <option key={r} value={r}>{r}</option>)}
                    </select>
                     <button onClick={() => navigate('/hospital/staff/add')} className="px-4 py-2 bg-brand-primary text-white rounded-lg hover:bg-brand-secondary">+ Add New Staff Member</button>
                </div>
                <div className="overflow-x-auto">
                    <table className="min-w-full">
                        <thead className="bg-slate-50 dark:bg-slate-700">
                            <tr>
                                <th className="py-3 px-6 text-left text-xs font-medium text-slate-500 dark:text-slate-300 uppercase tracking-wider">Name</th>
                                <th className="py-3 px-6 text-left text-xs font-medium text-slate-500 dark:text-slate-300 uppercase tracking-wider">Email</th>
                                <th className="py-3 px-6 text-left text-xs font-medium text-slate-500 dark:text-slate-300 uppercase tracking-wider">Role</th>
                                <th className="py-3 px-6 text-left text-xs font-medium text-slate-500 dark:text-slate-300 uppercase tracking-wider">Status</th>
                                <th className="py-3 px-6 text-left text-xs font-medium text-slate-500 dark:text-slate-300 uppercase tracking-wider">Actions</th>
                            </tr>
                        </thead>
                         <tbody className="divide-y divide-slate-200 dark:divide-slate-700">
                             {filteredStaff.map(s => (
                                <tr key={s.id} className="hover:bg-slate-50 dark:hover:bg-slate-700/50 transition-colors text-slate-700 dark:text-slate-300">
                                    <td className="py-4 px-6 whitespace-nowrap">{s.name}</td>
                                    <td className="py-4 px-6 whitespace-nowrap">{s.email}</td>
                                    <td className="py-4 px-6 whitespace-nowrap">{s.role}</td>
                                    <td className="py-4 px-6 whitespace-nowrap">
                                        <span className={`px-2 inline-flex text-xs leading-5 font-semibold rounded-full ${getStatusChip(s.status)}`}>
                                            {s.status}
                                        </span>
                                    </td>
                                    <td className="py-4 px-6 whitespace-nowrap text-sm font-medium space-x-2">
                                        <button onClick={() => navigate(`/hospital/staff/${s.id}`)} className="px-3 py-1 text-sm font-medium rounded-md border border-transparent text-brand-accent hover:bg-slate-50 dark:hover:bg-slate-700/60">View</button>

                                        <button onClick={() => navigate(`/hospital/staff/${s.id}/add-record`)} className="px-3 py-1 text-sm font-medium rounded-md bg-emerald-600 text-white hover:bg-emerald-700">Add Record</button>

                                        <button onClick={async () => {
                                            if (!confirm(`Are you sure you want to remove ${s.name} from hospital records?`)) return;
                                            try {
                                                // best-effort: call backend to remove staff (endpoint not implemented yet)
                                                alert('Removed from hospital records (simulated)');
                                                fetchStaff(searchTerm);
                                            } catch (err) { console.error(err); alert('Error removing staff'); }
                                        }} className="px-3 py-1 text-sm font-medium rounded-md bg-rose-600 text-white hover:bg-rose-700">Remove</button>
                                    </td>
                                </tr>
                             ))}
                         </tbody>
                    </table>
                </div>
                <div className="flex justify-between items-center pt-4">
                    <p className="text-sm text-slate-600 dark:text-slate-400">Showing {(page-1)*10+1} to {Math.min(page*10, total)} of {total} results</p>
                    <div className="flex items-center space-x-2">
                        <button disabled={page<=1} onClick={() => {
                            const newP = Math.max(1, page-1);
                            setPage(newP);
                            fetchStaff(searchTerm, newP);
                        }} className="px-3 py-1 border dark:border-slate-600 rounded-lg text-sm hover:bg-slate-100 dark:hover:bg-slate-700">Previous</button>
                        <button disabled={page*10>=total} onClick={() => {
                            const newP = page+1;
                            setPage(newP);
                            fetchStaff(searchTerm, newP);
                        }} className="px-3 py-1 border dark:border-slate-600 rounded-lg text-sm hover:bg-slate-100 dark:hover:bg-slate-700">Next</button>
                    </div>
                </div>
            </div>
        </Card>
    );
};

export default StaffManagement;