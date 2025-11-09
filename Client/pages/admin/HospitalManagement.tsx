import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Hospital, HospitalStatus } from '../../types';
import Card from '../../components/Card';

const mockHospitals: Hospital[] = [
    { id: '1', name: 'Apollo Hospital', location: 'Mumbai', status: HospitalStatus.ACTIVE, registrationDate: '2024-10-15' },
    { id: '2', name: 'City Hospital', location: 'Pune', status: HospitalStatus.PENDING, registrationDate: '2024-10-14' },
    { id: '3', name: 'Max Health', location: 'Delhi', status: HospitalStatus.ACTIVE, registrationDate: '2024-10-12' },
    { id: '4', name: 'Fortis Hospital', location: 'Bangalore', status: HospitalStatus.ACTIVE, registrationDate: '2024-10-11' },
    { id: '5', name: 'General Clinic', location: 'Kolkata', status: HospitalStatus.INACTIVE, registrationDate: '2024-09-20' },
];

const HospitalManagement: React.FC = () => {
    const [hospitals, setHospitals] = useState<Hospital[]>(mockHospitals);
    const [searchTerm, setSearchTerm] = useState('');
    const [filter, setFilter] = useState<HospitalStatus | 'All'>('All');
    const navigate = useNavigate();

    const filteredHospitals = hospitals
        .filter(h => filter === 'All' || h.status === filter)
        .filter(h => h.name.toLowerCase().includes(searchTerm.toLowerCase()) || h.location.toLowerCase().includes(searchTerm.toLowerCase()));

    const getStatusChip = (status: HospitalStatus) => {
        switch (status) {
            case HospitalStatus.ACTIVE: return 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200';
            case HospitalStatus.PENDING: return 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200';
            case HospitalStatus.INACTIVE: return 'bg-slate-100 text-slate-800 dark:bg-slate-700 dark:text-slate-300';
            default: return 'bg-slate-100 text-slate-800 dark:bg-slate-700';
        }
    };
    
    return (
        <Card title="Hospitals Directory">
            <div className="space-y-4">
                <div className="flex flex-col md:flex-row justify-between md:items-center gap-4">
                    <input 
                        type="text"
                        placeholder="Search Hospital..."
                        className="w-full md:w-1/3 px-3 py-2 border border-slate-300 dark:border-slate-600 rounded-lg focus:ring-brand-accent focus:border-brand-accent"
                        value={searchTerm}
                        onChange={e => setSearchTerm(e.target.value)}
                    />
                     <select 
                        className="w-full md:w-1/4 px-3 py-2 border border-slate-300 dark:border-slate-600 rounded-lg focus:ring-brand-accent focus:border-brand-accent"
                        value={filter}
                        onChange={e => setFilter(e.target.value as HospitalStatus | 'All')}
                    >
                        <option value="All">All Statuses</option>
                        {Object.values(HospitalStatus).map(s => <option key={s} value={s}>{s}</option>)}
                    </select>
                    <button onClick={() => navigate('/admin/hospitals/add')} className="px-4 py-2 bg-brand-primary text-white rounded-lg hover:bg-brand-secondary transition-transform transform hover:scale-105">+ Register New Hospital</button>
                </div>
                <div className="overflow-x-auto">
                    <table className="min-w-full">
                        <thead className="bg-slate-50 dark:bg-slate-700">
                            <tr>
                                <th className="py-3 px-6 text-left text-xs font-medium text-slate-500 dark:text-slate-300 uppercase tracking-wider">Hospital Name</th>
                                <th className="py-3 px-6 text-left text-xs font-medium text-slate-500 dark:text-slate-300 uppercase tracking-wider">Location</th>
                                <th className="py-3 px-6 text-left text-xs font-medium text-slate-500 dark:text-slate-300 uppercase tracking-wider">Status</th>
                                <th className="py-3 px-6 text-left text-xs font-medium text-slate-500 dark:text-slate-300 uppercase tracking-wider">Actions</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-200 dark:divide-slate-700">
                            {filteredHospitals.map(hospital => (
                                <tr key={hospital.id} className="hover:bg-slate-50 dark:hover:bg-slate-700/50 transition-colors text-slate-700 dark:text-slate-300">
                                    <td className="py-4 px-6 whitespace-nowrap">{hospital.name}</td>
                                    <td className="py-4 px-6 whitespace-nowrap">{hospital.location}</td>
                                    <td className="py-4 px-6 whitespace-nowrap">
                                        <span className={`px-2 inline-flex text-xs leading-5 font-semibold rounded-full ${getStatusChip(hospital.status)}`}>
                                            {hospital.status}
                                        </span>
                                    </td>
                                    <td className="py-4 px-6 whitespace-nowrap text-sm font-medium space-x-4">
                                        <button onClick={() => navigate(`/admin/hospitals/${hospital.id}`)} className="text-brand-accent hover:underline">View</button>
                                        <button onClick={() => alert('Edit functionality to be implemented.')} className="text-blue-500 hover:underline">Edit</button>
                                        <button onClick={() => confirm('Are you sure you want to delete this hospital?')} className="text-red-500 hover:underline">Delete</button>
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

export default HospitalManagement;