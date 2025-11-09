

import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import Card from '../../components/Card';
import { Patient, PatientStatus } from '../../types';

const mockPatients: Patient[] = [
    { id: 'P12345', name: 'John Doe', dob: '15-05-1990', status: PatientStatus.ACTIVE },
    { id: 'P12346', name: 'Jane Smith', dob: '22-07-1985', status: PatientStatus.ACTIVE },
    { id: 'P12347', name: 'Mike Patel', dob: '10-03-1992', status: PatientStatus.INACTIVE },
    { id: 'P12348', name: 'Emily White', dob: '01-11-2001', status: PatientStatus.ACTIVE },
    { id: 'P12349', name: 'Chris Green', dob: '18-09-1978', status: PatientStatus.ACTIVE },
];


const PatientManagement: React.FC = () => {
    const [patients] = useState<Patient[]>(mockPatients);
    const [searchTerm, setSearchTerm] = useState('');
    const navigate = useNavigate();

    const filteredPatients = patients.filter(p => 
        p.name.toLowerCase().includes(searchTerm.toLowerCase()) || 
        p.id.toLowerCase().includes(searchTerm.toLowerCase())
    );
    
    const getStatusChip = (status: PatientStatus) => {
        return status === PatientStatus.ACTIVE ? 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200' : 'bg-slate-100 text-slate-800 dark:bg-slate-700 dark:text-slate-300';
    };

    return (
        <Card title="Patient Management">
            <div className="space-y-4">
                <div className="flex flex-col md:flex-row justify-between md:items-center gap-4">
                    <input 
                        type="text"
                        placeholder="Search by Patient ID/Name..."
                        className="w-full md:w-1/3 px-3 py-2 border border-slate-300 dark:border-slate-600 rounded-lg focus:ring-brand-accent focus:border-brand-accent"
                        value={searchTerm}
                        onChange={e => setSearchTerm(e.target.value)}
                    />
                    <div className="flex items-center gap-2">
                         <button className="text-sm px-4 py-2 border dark:border-slate-600 rounded-lg hover:bg-slate-50 dark:hover:bg-slate-700">Advanced Filter ▼</button>
                         <button className="text-sm px-4 py-2 border dark:border-slate-600 rounded-lg hover:bg-slate-50 dark:hover:bg-slate-700">Export CSV</button>
                    </div>
                </div>

                <div className="overflow-x-auto">
                    <table className="min-w-full">
                        <thead className="bg-slate-50 dark:bg-slate-700">
                            <tr>
                                <th className="py-3 px-6 text-left text-xs font-medium text-slate-500 dark:text-slate-300 uppercase tracking-wider">Patient ID</th>
                                <th className="py-3 px-6 text-left text-xs font-medium text-slate-500 dark:text-slate-300 uppercase tracking-wider">Name</th>
                                <th className="py-3 px-6 text-left text-xs font-medium text-slate-500 dark:text-slate-300 uppercase tracking-wider">DOB</th>
                                <th className="py-3 px-6 text-left text-xs font-medium text-slate-500 dark:text-slate-300 uppercase tracking-wider">Status</th>
                                <th className="py-3 px-6 text-left text-xs font-medium text-slate-500 dark:text-slate-300 uppercase tracking-wider">Actions</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-200 dark:divide-slate-700">
                            {filteredPatients.map(patient => (
                                <tr key={patient.id} className="hover:bg-slate-50 dark:hover:bg-slate-700/50 transition-colors text-slate-700 dark:text-slate-300">
                                    <td className="py-4 px-6 whitespace-nowrap font-mono text-sm">{patient.id}</td>
                                    <td className="py-4 px-6 whitespace-nowrap">{patient.name}</td>
                                    <td className="py-4 px-6 whitespace-nowrap">{patient.dob}</td>
                                    <td className="py-4 px-6 whitespace-nowrap">
                                        <span className={`px-2 inline-flex text-xs leading-5 font-semibold rounded-full ${getStatusChip(patient.status)}`}>
                                            {patient.status}
                                        </span>
                                    </td>
                                    <td className="py-4 px-6 whitespace-nowrap text-sm font-medium space-x-2">
                                        <button onClick={() => navigate(`/hospital/patients/${patient.id}`)} className="text-brand-accent hover:text-brand-primary">View</button>
                                        <button onClick={() => navigate(`/hospital/patients/${patient.id}/edit`)} className="text-blue-600 hover:text-blue-900">Edit</button>
                                        <button onClick={() => navigate(`/hospital/patients/${patient.id}/add-record`)} className="text-green-600 hover:text-green-900">Add Record</button>
                                        <button onClick={() => confirm(`Are you sure you want to delete patient ${patient.name}?`)} className="text-red-600 hover:text-red-900">Delete</button>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>

                <div className="flex justify-between items-center pt-4">
                    <p className="text-sm text-slate-600 dark:text-slate-400">Showing 1 to 5 of 23 results</p>
                    <div className="flex items-center space-x-2">
                        <button className="px-3 py-1 border dark:border-slate-600 rounded-lg text-sm hover:bg-slate-100 dark:hover:bg-slate-700">Previous</button>
                        <button className="px-3 py-1 border dark:border-slate-600 rounded-lg text-sm hover:bg-slate-100 dark:hover:bg-slate-700">Next</button>
                    </div>
                </div>

            </div>
        </Card>
    );
};

export default PatientManagement;