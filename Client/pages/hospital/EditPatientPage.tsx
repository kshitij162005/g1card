
import React from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import Card from '../../components/Card';

const EditPatientPage: React.FC = () => {
    const { patientId } = useParams<{ patientId: string }>();
    const navigate = useNavigate();

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        notify(`Patient ${patientId} details updated successfully!`);
        navigate(`/hospital/patients/${patientId}`);
    };

    // Mock data for the form
    const patientData = {
        firstName: 'John',
        lastName: 'Doe',
        dob: '1990-05-15',
        email: 'john@example.com'
    };

    return (
        <div className="space-y-6">
             <div className="flex justify-between items-center">
                <h2 className="text-2xl font-bold text-gray-800">Edit Patient - {patientId}</h2>
                <button type="button" onClick={() => navigate(-1)} className="px-4 py-2 bg-gray-200 text-gray-800 text-sm rounded-md hover:bg-gray-300">
                    &larr; Back
                </button>
            </div>
            <Card>
                <form onSubmit={handleSubmit} className="p-4 space-y-4">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div>
                            <label htmlFor="firstName" className="block text-sm font-medium text-gray-700">First Name</label>
                            <input type="text" id="firstName" className="mt-1 block w-full border border-gray-300 rounded-md shadow-sm py-2 px-3" defaultValue={patientData.firstName} required />
                        </div>
                        <div>
                            <label htmlFor="lastName" className="block text-sm font-medium text-gray-700">Last Name</label>
                            <input type="text" id="lastName" className="mt-1 block w-full border border-gray-300 rounded-md shadow-sm py-2 px-3" defaultValue={patientData.lastName} required />
                        </div>
                        <div>
                            <label htmlFor="dob" className="block text-sm font-medium text-gray-700">Date of Birth</label>
                            <input type="date" id="dob" className="mt-1 block w-full border border-gray-300 rounded-md shadow-sm py-2 px-3" defaultValue={patientData.dob} required />
                        </div>
                         <div>
                            <label htmlFor="email" className="block text-sm font-medium text-gray-700">Email Address</label>
                            <input type="email" id="email" className="mt-1 block w-full border border-gray-300 rounded-md shadow-sm py-2 px-3" defaultValue={patientData.email} required />
                        </div>
                    </div>
                    <div className="flex justify-end">
                        <button type="submit" className="px-6 py-2 bg-brand-primary text-white font-semibold rounded-md hover:bg-brand-secondary">
                            Save Changes
                        </button>
                    </div>
                </form>
            </Card>
        </div>
    );
};

export default EditPatientPage;
