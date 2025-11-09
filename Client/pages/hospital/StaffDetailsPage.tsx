
import React from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import Card from '../../components/Card';
import { StaffRole } from '../../types';

const StaffDetailsPage: React.FC = () => {
    const { staffId } = useParams<{ staffId: string }>();
    const navigate = useNavigate();

    // Mock data
    const staffMember = {
        name: 'Dr. Raj',
        email: 'raj@apollo.com',
        role: StaffRole.DOCTOR,
        status: 'Active'
    };

    return (
        <div className="space-y-6">
            <div className="flex justify-between items-center">
                <h2 className="text-2xl font-bold text-gray-800">Staff Details - {staffId}</h2>
                <button onClick={() => navigate(-1)} className="px-4 py-2 bg-gray-200 text-gray-800 text-sm rounded-md hover:bg-gray-300">
                    &larr; Back
                </button>
            </div>
            <Card>
                <div className="p-4 space-y-2">
                    <p><strong>Name:</strong> {staffMember.name}</p>
                    <p><strong>Email:</strong> {staffMember.email}</p>
                    <p><strong>Role:</strong> {staffMember.role}</p>
                    <p><strong>Status:</strong> {staffMember.status}</p>
                </div>
            </Card>
             <Card title="Actions">
                <div className="p-4 flex gap-4">
                     <button className="px-4 py-2 bg-blue-500 text-white rounded-md hover:bg-blue-600 text-sm">Edit Role</button>
                     <button className="px-4 py-2 bg-yellow-500 text-white rounded-md hover:bg-yellow-600 text-sm">Deactivate</button>
                     <button className="px-4 py-2 bg-red-500 text-white rounded-md hover:bg-red-600 text-sm">Delete</button>
                </div>
            </Card>
        </div>
    );
};

export default StaffDetailsPage;
