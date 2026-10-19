
import React from 'react';
import Card from '../../components/Card';
import { useNavigate } from 'react-router-dom';

const ReportsPage: React.FC = () => {
    const navigate = useNavigate();
    return (
        <Card title="Generate Reports">
            <div className="space-y-5">
                <div className="rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/40 p-5">
                    <h3 className="text-lg font-semibold text-slate-800 dark:text-slate-100">Reporting Feature</h3>
                    <p className="mt-2 text-sm text-slate-600 dark:text-slate-400">
                        Reports are being finalized. You will be able to generate, download, and schedule reports from this page soon.
                    </p>
                </div>

                <div className="grid grid-cols-1 gap-4">
                    <div className="p-4 border border-slate-200 dark:border-slate-700 rounded-lg bg-white dark:bg-slate-900/30 flex items-center justify-between">
                        <div>
                            <p className="font-semibold text-slate-800 dark:text-slate-100">Patient Demographics Report</p>
                            <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">Age, gender and registration distribution.</p>
                        </div>
                        <button type="button" className="text-sm px-4 py-2 bg-slate-200 dark:bg-slate-700 text-slate-500 dark:text-slate-400 rounded-md cursor-not-allowed" disabled>
                            Generate
                        </button>
                    </div>
                    <div className="p-4 border border-slate-200 dark:border-slate-700 rounded-lg bg-white dark:bg-slate-900/30 flex items-center justify-between">
                        <div>
                            <p className="font-semibold text-slate-800 dark:text-slate-100">Patient Activity Log</p>
                            <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">Every record view, access request and new record, with search, filters and CSV export.</p>
                        </div>
                        <button type="button" className="text-sm px-4 py-2 bg-brand-primary text-white rounded-md" onClick={() => navigate('/hospital/logs')}>
                            Open activity log
                        </button>
                    </div>
                </div>
            </div>
        </Card>
    );
};

export default ReportsPage;
