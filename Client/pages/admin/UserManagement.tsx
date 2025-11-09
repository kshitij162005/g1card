
import React, { useState } from 'react';
import { SystemUser, Role } from '../../types';
import Card from '../../components/Card';

const mockUsers: SystemUser[] = [
    { id: 'u1', name: 'Dr. Raj', email: 'raj@apollo.com', role: Role.HOSPITAL, status: 'Active', createdDate: '2024-10-10' },
    { id: 'u2', name: 'Patient A', email: 'patienta@email.com', role: Role.PATIENT, status: 'Active', createdDate: '2024-10-12' },
    { id: 'u3', name: 'Nurse B', email: 'nurseb@city.com', role: Role.HOSPITAL, status: 'Active', createdDate: '2024-10-13' },
    { id: 'u4', name: 'Kshitij K.', email: 'kotechakshitij@gmail.com', role: Role.SUPER_ADMIN, status: 'Active', createdDate: '2024-01-01' },
    { id: 'u5', name: 'Patient C', email: 'patientc@email.com', role: Role.PATIENT, status: 'Inactive', createdDate: '2024-09-15' },
];

const UserManagement: React.FC = () => {
    const [users, setUsers] = useState<SystemUser[]>(mockUsers);
    const [searchTerm, setSearchTerm] = useState('');
    const [filterRole, setFilterRole] = useState<Role | 'All'>('All');

    const filteredUsers = users
        .filter(u => filterRole === 'All' || u.role === filterRole)
        .filter(u => u.name.toLowerCase().includes(searchTerm.toLowerCase()) || u.email.toLowerCase().includes(searchTerm.toLowerCase()));
    
    const getStatusChip = (status: 'Active' | 'Inactive') => {
        return status === 'Active' ? 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200' : 'bg-slate-100 text-slate-800 dark:bg-slate-700 dark:text-slate-300';
    };

    return (
        <Card title="User Management">
            <div className="space-y-4">
                 <div className="flex flex-col md:flex-row justify-between md:items-center gap-4">
                     <input 
                        type="text"
                        placeholder="Search by email/name..."
                        className="w-full md:w-1/3 px-3 py-2 border border-slate-300 dark:border-slate-600 rounded-lg focus:ring-brand-accent focus:border-brand-accent"
                        value={searchTerm}
                        onChange={e => setSearchTerm(e.target.value)}
                    />
                    <select 
                        className="w-full md:w-1/4 px-3 py-2 border border-slate-300 dark:border-slate-600 rounded-lg focus:ring-brand-accent focus:border-brand-accent"
                        value={filterRole}
                        onChange={e => setFilterRole(e.target.value as Role | 'All')}
                    >
                        <option value="All">All Roles</option>
                        {Object.values(Role).map(r => <option key={r} value={r}>{r}</option>)}
                    </select>
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
                             {filteredUsers.map(user => (
                                <tr key={user.id} className="hover:bg-slate-50 dark:hover:bg-slate-700/50 transition-colors text-slate-700 dark:text-slate-300">
                                    <td className="py-4 px-6 whitespace-nowrap">{user.name}</td>
                                    <td className="py-4 px-6 whitespace-nowrap">{user.email}</td>
                                    <td className="py-4 px-6 whitespace-nowrap">{user.role}</td>
                                    <td className="py-4 px-6 whitespace-nowrap">
                                        <span className={`px-2 inline-flex text-xs leading-5 font-semibold rounded-full ${getStatusChip(user.status)}`}>
                                            {user.status}
                                        </span>
                                    </td>
                                    <td className="py-4 px-6 whitespace-nowrap text-sm font-medium space-x-2">
                                        <button onClick={() => alert('View functionality to be implemented.')} className="text-brand-accent hover:text-brand-primary">View</button>
                                        <button onClick={() => alert('Edit functionality to be implemented.')} className="text-blue-600 hover:text-blue-900">Edit</button>
                                        <button onClick={() => confirm('Are you sure you want to delete this user?')} className="text-red-600 hover:text-red-900">Delete</button>
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

export default UserManagement;