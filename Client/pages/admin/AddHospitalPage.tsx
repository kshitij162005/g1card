
import React from 'react';
import { useNavigate } from 'react-router-dom';
import Card from '../../components/Card';

const AddHospitalPage: React.FC = () => {
    const navigate = useNavigate();

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        alert('New hospital added successfully!');
        navigate('/admin/hospitals');
    };

    return (
        <div className="space-y-6">
             <div className="flex justify-between items-center">
                <h2 className="text-2xl font-bold text-gray-800">Register New Hospital</h2>
                <button onClick={() => navigate(-1)} className="px-4 py-2 bg-gray-200 text-gray-800 text-sm rounded-md hover:bg-gray-300">
                    &larr; Back
                </button>
            </div>
            <Card>
                <form onSubmit={handleSubmit} className="p-4 space-y-4">
                    <div>
                        <label htmlFor="hospitalName" className="block text-sm font-medium text-gray-700">Hospital Name</label>
                        <input type="text" id="hospitalName" className="mt-1 block w-full border border-gray-300 rounded-md shadow-sm py-2 px-3 focus:outline-none focus:ring-brand-accent focus:border-brand-accent" required />
                    </div>
                    <div>
                        <label htmlFor="location" className="block text-sm font-medium text-gray-700">Location</label>
                        <input type="text" id="location" className="mt-1 block w-full border border-gray-300 rounded-md shadow-sm py-2 px-3 focus:outline-none focus:ring-brand-accent focus:border-brand-accent" required />
                    </div>
                    <div>
                        <label htmlFor="adminEmail" className="block text-sm font-medium text-gray-700">Administrator Email</label>
                        <input type="email" id="adminEmail" className="mt-1 block w-full border border-gray-300 rounded-md shadow-sm py-2 px-3 focus:outline-none focus:ring-brand-accent focus:border-brand-accent" required />
                    </div>
                    <div className="flex justify-end">
                        <button type="submit" className="px-6 py-2 bg-brand-primary text-white font-semibold rounded-md hover:bg-brand-secondary">
                            Add Hospital
                        </button>
                    </div>
                </form>
            </Card>
        </div>
    );
};

export default AddHospitalPage;
