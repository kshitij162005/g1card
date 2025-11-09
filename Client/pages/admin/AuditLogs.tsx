

import React, { useState } from 'react';
import { AuditLog, Role } from '../../types';
import Card from '../../components/Card';

const mockLogs: AuditLog[] = [
    { id: 'l1', timestamp: '2024-10-15 10:30:00', user: 'Dr. Raj', userRole: Role.HOSPITAL, action: 'Login', status: 'Success' },
    { id: 'l2', timestamp: '2024-10-15 10:25:15', user: 'Patient A', userRole: Role.PATIENT, action: 'View Medical Record', status: 'Success' },
    { id: 'l3', timestamp: '2024-10-15 10:20:05', user: 'Admin', userRole: Role.SUPER_ADMIN, action: 'Verify Hospital', status: 'Success' },
    { id: 'l4', timestamp: '2024-10-15 10:15:45', user: 'New Hospital Inc.', userRole: Role.HOSPITAL, action: 'Register', status: 'Success' },
    { id: 'l5', timestamp: '2024-10-15 10:10:00', user: 'Unknown', userRole: Role.PATIENT, action: 'Login Attempt', status: 'Failure' },
];

const AuditLogs: React.FC = () => {
    const [logs, setLogs] = useState(mockLogs);

    return (
        <Card title="Audit Logs & Analytics">
            <div className="space-y-4">
                <div className="flex flex-col md:flex-row justify-between items-center gap-4">
                    <div className="flex gap-4">
                        <input type="date" className="border border-slate-300 dark:border-slate-600 rounded-lg p-2"/>
                        <input type="text" placeholder="Filter by User" className="border border-slate-300 dark:border-slate-600 rounded-lg p-2"/>
                        <select className="border border-slate-300 dark:border-slate-600 rounded-lg p-2">
                            <option>Filter by Action</option>
                            <option>Login</option>
                            <option>Register</option>
                        </select>
                    </div>
                     <div className="flex gap-2">
                         <button className="px-4 py-2 bg-brand-primary text-white rounded-lg hover:bg-brand-secondary text-sm">Export as CSV</button>
                         <button className="px-4 py-2 bg-slate-200 dark:bg-slate-700 text-slate-800 dark:text-slate-200 rounded-lg hover:bg-slate-300 dark:hover:bg-slate-600 text-sm">Print</button>
                    </div>
                </div>
                 <div className="overflow-x-auto">
                    <table className="min-w-full">
                        <thead className="bg-slate-50 dark:bg-slate-700">
                            <tr>
                                <th className="py-3 px-6 text-left text-xs font-medium text-slate-500 dark:text-slate-300 uppercase tracking-wider">Timestamp</th>
                                <th className="py-3 px-6 text-left text-xs font-medium text-slate-500 dark:text-slate-300 uppercase tracking-wider">User</th>
                                <th className="py-3 px-6 text-left text-xs font-medium text-slate-500 dark:text-slate-300 uppercase tracking-wider">Role</th>
                                <th className="py-3 px-6 text-left text-xs font-medium text-slate-500 dark:text-slate-300 uppercase tracking-wider">Action</th>
                                <th className="py-3 px-6 text-left text-xs font-medium text-slate-500 dark:text-slate-300 uppercase tracking-wider">Status</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-200 dark:divide-slate-700">
                            {logs.map(log => (
                                <tr key={log.id} className="hover:bg-slate-50 dark:hover:bg-slate-700/50 transition-colors text-slate-700 dark:text-slate-300">
                                    <td className="py-4 px-6 whitespace-nowrap">{log.timestamp}</td>
                                    <td className="py-4 px-6 whitespace-nowrap">{log.user}</td>
                                    <td className="py-4 px-6 whitespace-nowrap">{log.userRole}</td>
                                    <td className="py-4 px-6 whitespace-nowrap">{log.action}</td>
                                    <td className="py-4 px-6 whitespace-nowrap">
                                        <span className={`px-2 inline-flex text-xs leading-5 font-semibold rounded-full ${log.status === 'Success' ? 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200' : 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200'}`}>
                                            {log.status}
                                        </span>
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

export default AuditLogs;