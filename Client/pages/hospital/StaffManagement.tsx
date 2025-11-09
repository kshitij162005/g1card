

import React, { useState } from 'react';
import Card from '../../components/Card';
import { Staff, StaffRole } from '../../types';
import { useNavigate } from 'react-router-dom';

const mockStaff: Staff[] = [
    { id: 's1', name: 'Dr. Raj', email: 'raj@apollo.com', role: StaffRole.DOCTOR, status: 'Active' },
    { id: 's2', name: 'Nurse A', email: 'nursea@apollo.com', role: StaffRole.NURSE, status: 'Active' },
    { id: 's3', name: 'Staff B', email: 'staffb@apollo.com', role: StaffRole.ADMIN, status: 'Active' },
    { id: 's4', name: 'Dr. Emily', email: 'emily@apollo.com', role: StaffRole.DOCTOR, status: 'Inactive' },
];

const StaffManagement: React.FC = () => {
    const [staff, setStaff] = useState<Staff[]>(mockStaff);
    const [searchTerm, setSearchTerm] = useState('');
    const [filterRole, setFilterRole] = useState<StaffRole | 'All'>('All');
    const navigate = useNavigate();

    const filteredStaff = staff
        .filter(s => filterRole === 'All' || s.role === filterRole)
        .filter(s => s.name.toLowerCase().includes(searchTerm.toLowerCase()) || s.email.toLowerCase().includes(searchTerm.toLowerCase()));
    
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
                        className="w-full md:w-1/3 px-3 py-2 border border-slate-300 dark:border-slate-600 rounded-lg focus:ring-brand-accent focus:border-brand-accent"
                        value={searchTerm}
                        onChange={e => setSearchTerm(e.target.value)}
                    />
                    <select 
                        className="w-full md:w-1/4 px-3 py-2 border border-slate-300 dark:border-slate-600 rounded-lg focus:ring-brand-accent focus:border-brand-accent"
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
                                        <button onClick={() => navigate(`/hospital/staff/${s.id}`)} className="text-brand-accent hover:text-brand-primary">View</button>
                                        <button onClick={() => alert('Edit Role functionality to be implemented.')} className="text-blue-600 hover:text-blue-900">Edit Role</button>
                                        <button onClick={() => confirm(`Are you sure you want to deactivate ${s.name}?`)} className="text-yellow-600 hover:text-yellow-900">Deactivate</button>
                                        <button onClick={() => confirm(`Are you sure you want to delete ${s.name}?`)} className="text-red-600 hover:text-red-900">Delete</button>
                                    </td>
                                </tr>
                             ))}
                         </tbody>
                    </table>
                </div>
            </div>
        </Card>
    );
};

export default StaffManagement;