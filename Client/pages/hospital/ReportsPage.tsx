
import React from 'react';
import Card from '../../components/Card';

const ReportsPage: React.FC = () => {
    return (
        <Card title="Generate Reports">
            <div className="p-4 text-center">
                <h3 className="text-lg font-semibold text-gray-700">Reporting Feature</h3>
                <p className="mt-2 text-gray-500">This feature is under construction. You will be able to generate and download various reports soon.</p>
                <div className="mt-6 space-y-4">
                    <div className="p-4 border rounded-md bg-gray-50">
                        <p className="font-semibold">Patient Demographics Report</p>
                        <button className="mt-2 text-sm px-4 py-2 bg-gray-300 text-gray-600 rounded-md cursor-not-allowed">Generate</button>
                    </div>
                    <div className="p-4 border rounded-md bg-gray-50">
                        <p className="font-semibold">Patient Activity Log</p>
                        <button className="mt-2 text-sm px-4 py-2 bg-gray-300 text-gray-600 rounded-md cursor-not-allowed">Generate</button>
                    </div>
                </div>
            </div>
        </Card>
    );
};

export default ReportsPage;
