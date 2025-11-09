
import React from 'react';
import { useNavigate } from 'react-router-dom';
import Card from '../../components/Card';
import { StaffRole } from '../../types';

const AddStaffPage: React.FC = () => {
    const navigate = useNavigate();

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        alert('New staff member added successfully!');
        navigate('/hospital/staff');
    };

    return (
        <div className="space-y-6">
             <div className="flex justify-between items-center">
                <h2 className="text-2xl font-bold text-gray-800">Add New Staff Member</h2>
                <button onClick={() => navigate(-1)} className="px-4 py-2 bg-gray-200 text-gray-800 text-sm rounded-md hover:bg-gray-300">
                    &larr; Back
                </button>
            </div>
            <Card>
                <form onSubmit={handleSubmit} className="p-4 space-y-4">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div>
                            <label htmlFor="staffName" className="block text-sm font-medium text-gray-700">Full Name</label>
                            <input type="text" id="staffName" className="mt-1 block w-full border border-gray-300 rounded-md shadow-sm py-2 px-3" required />
                        </div>
                        <div>
                            <label htmlFor="staffEmail" className="block text-sm font-medium text-gray-700">Email Address</label>
                            <input type="email" id="staffEmail" className="mt-1 block w-full border border-gray-300 rounded-md shadow-sm py-2 px-3" required />
                        </div>
                        <div>
                            <label htmlFor="staffRole" className="block text-sm font-medium text-gray-700">Role</label>
                            <select id="staffRole" className="mt-1 block w-full border border-gray-300 rounded-md shadow-sm py-2 px-3 bg-white" required>
                                {Object.values(StaffRole).map(r => <option key={r} value={r}>{r}</option>)}
                            </select>
                        </div>
                    </div>
                    <div className="flex justify-end">
                        <button type="submit" className="px-6 py-2 bg-brand-primary text-white font-semibold rounded-md hover:bg-brand-secondary">
                            Add Staff Member
                        </button>
                    </div>
                </form>
            </Card>
        </div>
    );
};

export default AddStaffPage;
