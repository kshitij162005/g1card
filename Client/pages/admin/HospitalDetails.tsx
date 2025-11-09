
import React from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import Card from '../../components/Card';
import { HospitalStatus } from '../../types';

const mockHospitalDetails = {
    '1': {
        name: 'Apollo Hospital',
        location: 'Mumbai, Maharashtra',
        email: 'contact@apollo.com',
        registrationDate: '15 Oct 2024',
        licenseNo: 'LIC123456',
        status: HospitalStatus.ACTIVE,
        administrator: {
            name: 'Dr. Rajesh Kumar',
            email: 'rajesh@apollo.com',
            phone: '+91-9876543210'
        },
        stats: {
            patients: 2450,
            staff: 85,
            records: 8932,
            lastActivity: '2 hours ago'
        },
        documents: {
            license: 'Verified',
            registration: 'Verified',
            insurance: 'Pending',
            taxId: 'Verified'
        }
    }
};

const DetailItem: React.FC<{ label: string; value: string | number }> = ({ label, value }) => (
    <div className="grid grid-cols-3 gap-4 py-2">
        <dt className="text-sm font-medium text-gray-500">{label}</dt>
        <dd className="text-sm text-gray-900 col-span-2">{value}</dd>
    </div>
);

const VerificationItem: React.FC<{ name: string; status: 'Verified' | 'Pending' }> = ({ name, status }) => (
     <li className="flex items-center justify-between py-2">
        <p className="text-sm font-medium text-gray-800">{name}</p>
        <div className="flex items-center">
            {status === 'Verified' ? 
                <svg className="w-5 h-5 text-status-green" fill="currentColor" viewBox="0 0 20 20"><path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" /></svg> :
                <svg className="w-5 h-5 text-status-yellow" fill="currentColor" viewBox="0 0 20 20"><path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm1-12a1 1 0 10-2 0v4a1 1 0 102 0V6zM10 15a1 1 0 100-2 1 1 0 000 2z" clipRule="evenodd" /></svg>
            }
            <span className={`ml-2 text-sm font-semibold ${status === 'Verified' ? 'text-status-green' : 'text-status-yellow'}`}>{status}</span>
        </div>
    </li>
);


const HospitalDetails: React.FC = () => {
    const { id } = useParams<{ id: string }>();
    const navigate = useNavigate();
    const hospital = id ? mockHospitalDetails[id as keyof typeof mockHospitalDetails] : null;

    if (!hospital) {
        return <div className="text-center p-8">Hospital not found.</div>
    }

    return (
        <div className="space-y-6">
            <div className="flex justify-between items-center">
                <h2 className="text-2xl font-bold text-gray-800">Hospital Details</h2>
                <button onClick={() => navigate(-1)} className="px-4 py-2 bg-gray-200 text-gray-800 text-sm rounded-md hover:bg-gray-300">
                    &larr; Back
                </button>
            </div>
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                <div className="lg:col-span-2 space-y-6">
                    <Card title="Hospital Information">
                        <dl className="divide-y divide-gray-200">
                           <DetailItem label="Name" value={hospital.name} />
                           <DetailItem label="Location" value={hospital.location} />
                           <DetailItem label="Email" value={hospital.email} />
                           <DetailItem label="Registration Date" value={hospital.registrationDate} />
                           <DetailItem label="License No" value={hospital.licenseNo} />
                           <DetailItem label="Status" value={hospital.status} />
                        </dl>
                    </Card>
                     <Card title="Administrator">
                        <dl className="divide-y divide-gray-200">
                           <DetailItem label="Name" value={hospital.administrator.name} />
                           <DetailItem label="Email" value={hospital.administrator.email} />
                           <DetailItem label="Phone" value={hospital.administrator.phone} />
                        </dl>
                    </Card>
                </div>
                <div className="space-y-6">
                    <Card title="Statistics">
                         <dl className="divide-y divide-gray-200">
                           <DetailItem label="Total Patients" value={hospital.stats.patients} />
                           <DetailItem label="Total Staff" value={hospital.stats.staff} />
                           <DetailItem label="Medical Records" value={hospital.stats.records} />
                           <DetailItem label="Last Activity" value={hospital.stats.lastActivity} />
                        </dl>
                    </Card>
                    <Card title="Verification Documents">
                        <ul className="divide-y divide-gray-200">
                            <VerificationItem name="License Verified" status={hospital.documents.license as 'Verified' | 'Pending'} />
                            <VerificationItem name="Registration Verified" status={hospital.documents.registration as 'Verified' | 'Pending'} />
                            <VerificationItem name="Insurance Certificate" status={hospital.documents.insurance as 'Verified' | 'Pending'} />
                            <VerificationItem name="Tax ID Verified" status={hospital.documents.taxId as 'Verified' | 'Pending'} />
                        </ul>
                    </Card>
                    <Card title="Admin Controls">
                         <div className="flex flex-wrap gap-2">
                             <button className="flex-grow px-3 py-2 bg-blue-500 text-white text-sm rounded-md hover:bg-blue-600">Edit</button>
                             <button className="flex-grow px-3 py-2 bg-green-500 text-white text-sm rounded-md hover:bg-green-600">Verify Docs</button>
                             <button className="flex-grow px-3 py-2 bg-yellow-500 text-white text-sm rounded-md hover:bg-yellow-600">Suspend</button>
                             <button className="flex-grow px-3 py-2 bg-red-500 text-white text-sm rounded-md hover:bg-red-600">Delete</button>
                         </div>
                    </Card>
                </div>
            </div>
        </div>
    );
};

export default HospitalDetails;
