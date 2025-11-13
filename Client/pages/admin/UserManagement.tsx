
import React, { useState, useEffect } from 'react';
import Card from '../../components/Card';

interface Patient {
    _id: string;
    username?: string;
    name?: string;
    firstName?: string;
    lastName?: string;
    email?: string;
    phone?: string;
    patientId?: string;
    hospitalName?: string;
    createdAt: string;
}



const UserManagement: React.FC = () => {
    const [patients, setPatients] = useState<Patient[]>([]);
    const [searchTerm, setSearchTerm] = useState('');
    const [loading, setLoading] = useState(false);
    const [patientPage, setPatientPage] = useState(1);
    const [patientPagination, setPatientPagination] = useState({ total: 0, pages: 1, limit: 10 });

    useEffect(() => {
        fetchPatients();
    }, [searchTerm, patientPage]);

    const fetchPatients = async () => {
        setLoading(true);
        try {
            const resp = await fetch(`http://localhost:8082/api/superadmin/patients?search=${searchTerm}&page=${patientPage}&limit=10`);
            const data = await resp.json();
            if (!resp.ok) throw new Error(data.error || 'Failed');
            setPatients(data.patients || []);
            setPatientPagination(data.pagination || { total: 0, pages: 1, limit: 10 });
        } catch (err) {
            console.error('fetch patients error:', err);
        } finally {
            setLoading(false);
        }
    };





    return (
        <Card title="User Management">
            <div className="space-y-4">
                <div className="flex flex-col md:flex-row justify-between md:items-center gap-4">
                    <input
                        type="text"
                        placeholder="Search patients..."
                        className="w-full md:w-1/3 px-3 py-2 border border-slate-300 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 placeholder:text-slate-400 focus:ring-brand-accent focus:border-brand-accent"
                        value={searchTerm}
                        onChange={e => {
                            setSearchTerm(e.target.value);
                            setPatientPage(1);
                        }}
                    />
                    <div className="text-sm text-slate-600 dark:text-slate-400">
                        Total Patients: {patientPagination.total}
                    </div>
                </div>

                {loading ? (
                    <p className="text-sm text-slate-500 dark:text-slate-400 text-center py-8">Loading patients...</p>
                ) : (
                    <>
                        <div className="overflow-x-auto">
                            <table className="min-w-full">
                                    <thead className="bg-slate-50 dark:bg-slate-700">
                                        <tr>
                                            <th className="py-3 px-6 text-left text-xs font-medium text-slate-500 dark:text-slate-300 uppercase tracking-wider">Username</th>
                                            <th className="py-3 px-6 text-left text-xs font-medium text-slate-500 dark:text-slate-300 uppercase tracking-wider">Patient ID</th>
                                            <th className="py-3 px-6 text-left text-xs font-medium text-slate-500 dark:text-slate-300 uppercase tracking-wider">Name</th>
                                            <th className="py-3 px-6 text-left text-xs font-medium text-slate-500 dark:text-slate-300 uppercase tracking-wider">Email</th>
                                            <th className="py-3 px-6 text-left text-xs font-medium text-slate-500 dark:text-slate-300 uppercase tracking-wider">Phone</th>
                                            <th className="py-3 px-6 text-left text-xs font-medium text-slate-500 dark:text-slate-300 uppercase tracking-wider">Hospital</th>
                                            <th className="py-3 px-6 text-left text-xs font-medium text-slate-500 dark:text-slate-300 uppercase tracking-wider">Registered</th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-slate-200 dark:divide-slate-700">
                                        {patients.length === 0 ? (
                                            <tr>
                                                <td colSpan={7} className="py-4 px-6 text-center text-slate-500 dark:text-slate-400">
                                                    No patients found.
                                                </td>
                                            </tr>
                                        ) : (
                                            patients.map(patient => (
                                                <tr key={patient._id} className="hover:bg-slate-50 dark:hover:bg-slate-700/50 transition-colors">
                                                    <td className="py-4 px-6 whitespace-nowrap">
                                                        <span className="text-slate-800 dark:text-slate-200 font-medium">
                                                            {patient.username || 'N/A'}
                                                        </span>
                                                    </td>
                                                    <td className="py-4 px-6 whitespace-nowrap">
                                                        <span className={patient.patientId ? 'text-slate-800 dark:text-slate-200' : 'text-slate-400 dark:text-slate-500 italic'}>
                                                            {patient.patientId || 'Not assigned'}
                                                        </span>
                                                    </td>
                                                    <td className="py-4 px-6 whitespace-nowrap">
                                                        <span className={patient.name && patient.name !== 'N/A' ? 'text-slate-800 dark:text-slate-200' : 'text-slate-400 dark:text-slate-500 italic'}>
                                                            {patient.name || 'Not provided'}
                                                        </span>
                                                    </td>
                                                    <td className="py-4 px-6 whitespace-nowrap">
                                                        <span className={patient.email ? 'text-slate-700 dark:text-slate-300' : 'text-slate-400 dark:text-slate-500 italic'}>
                                                            {patient.email || 'Not provided'}
                                                        </span>
                                                    </td>
                                                    <td className="py-4 px-6 whitespace-nowrap">
                                                        <span className={patient.phone ? 'text-slate-700 dark:text-slate-300' : 'text-slate-400 dark:text-slate-500 italic'}>
                                                            {patient.phone || 'Not provided'}
                                                        </span>
                                                    </td>
                                                    <td className="py-4 px-6 whitespace-nowrap text-slate-700 dark:text-slate-300">
                                                        {patient.hospitalName || 'N/A'}
                                                    </td>
                                                    <td className="py-4 px-6 whitespace-nowrap text-slate-700 dark:text-slate-300">
                                                        {new Date(patient.createdAt).toLocaleDateString()}
                                                    </td>
                                                </tr>
                                            ))
                                        )}
                                    </tbody>
                                </table>
                        </div>

                        {patientPagination.pages > 1 && (
                            <div className="flex justify-between items-center mt-4">
                                <div className="text-sm text-slate-600 dark:text-slate-400">
                                    Showing {((patientPage - 1) * patientPagination.limit) + 1} to {Math.min(patientPage * patientPagination.limit, patientPagination.total)} of {patientPagination.total} patients
                                </div>
                                <div className="flex gap-2">
                                    <button
                                        disabled={patientPage === 1}
                                        onClick={() => setPatientPage(p => p - 1)}
                                        className="px-3 py-1 border border-slate-300 dark:border-slate-600 rounded bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-300 disabled:opacity-50 disabled:cursor-not-allowed hover:bg-slate-50 dark:hover:bg-slate-700"
                                    >
                                        Previous
                                    </button>
                                    <span className="px-3 py-1 text-slate-700 dark:text-slate-300">
                                        Page {patientPage} of {patientPagination.pages}
                                    </span>
                                    <button
                                        disabled={patientPage === patientPagination.pages}
                                        onClick={() => setPatientPage(p => p + 1)}
                                        className="px-3 py-1 border border-slate-300 dark:border-slate-600 rounded bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-300 disabled:opacity-50 disabled:cursor-not-allowed hover:bg-slate-50 dark:hover:bg-slate-700"
                                    >
                                        Next
                                    </button>
                                </div>
                            </div>
                        )}
                    </>
                )}
            </div>
        </Card>
    );
};

export default UserManagement;