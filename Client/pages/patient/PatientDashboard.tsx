
import React from 'react';
import { useAuth } from '../../contexts/AuthContext';
import Card from '../../components/Card';
import { useNavigate } from 'react-router-dom';

const HealthSummaryItem: React.FC<{ label: string; value: string }> = ({ label, value }) => (
    <div className="text-center">
        <p className="text-sm text-gray-500">{label}</p>
        <p className="text-lg font-bold text-gray-800">{value}</p>
    </div>
);

const QuickInfoItem: React.FC<{ icon: string; label: string; value: string; color: string }> = ({ icon, label, value, color }) => (
    <div className="flex items-center py-2">
        <span className={`text-xl ${color}`}>{icon}</span>
        <span className="ml-3 text-sm font-medium text-gray-700">{label}:</span>
        <span className="ml-auto text-sm text-gray-900 font-semibold">{value}</span>
    </div>
);

const AuthorizedHospitalItem: React.FC<{ name: string; access: string }> = ({ name, access }) => (
     <li className="flex items-center justify-between py-2">
        <div className="flex items-center">
            <svg className="w-5 h-5 text-status-green" fill="currentColor" viewBox="0 0 20 20"><path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" /></svg>
            <span className="ml-2 text-sm font-medium">{name}</span>
        </div>
        <span className="text-sm text-gray-600">{access}</span>
    </li>
);

const PatientDashboard: React.FC = () => {
    const { user } = useAuth();
    const navigate = useNavigate();

    return (
        <div className="space-y-6">
            <div>
                <h2 className="text-2xl font-bold text-gray-800">Welcome Back, {user?.name}!</h2>
                <p className="text-sm text-gray-500">Last Access: 2 days ago</p>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                <div className="lg:col-span-2 space-y-6">
                    <Card title="Your Health Summary">
                        <div className="flex justify-around items-center">
                            <HealthSummaryItem label="Blood Group" value="B+" />
                            <HealthSummaryItem label="Age" value="34 years" />
                            <HealthSummaryItem label="Height" value={'5\'10"'} />
                            <HealthSummaryItem label="Weight" value="75 kg" />
                            <HealthSummaryItem label="BMI" value="24.5" />
                        </div>
                    </Card>
                    <Card title="Quick Actions">
                        <div className="flex flex-wrap gap-4">
                            <button onClick={() => navigate('/patient/health-history')} className="px-4 py-2 bg-brand-primary text-white text-sm rounded-md hover:bg-brand-secondary">View Full Medical History</button>
                            <button onClick={() => alert('Preparing your records for download...')} className="px-4 py-2 bg-gray-200 text-gray-800 text-sm rounded-md hover:bg-gray-300">Download Records</button>
                            <button onClick={() => navigate('/patient/settings')} className="px-4 py-2 bg-gray-200 text-gray-800 text-sm rounded-md hover:bg-gray-300">Manage Permissions</button>
                            <button onClick={() => navigate('/patient/settings')} className="px-4 py-2 bg-gray-200 text-gray-800 text-sm rounded-md hover:bg-gray-300">Edit Profile</button>
                        </div>
                    </Card>
                     <Card title="Authorized Hospitals">
                         <ul className="divide-y divide-gray-200">
                             <AuthorizedHospitalItem name="Apollo Hospital" access="Full Access" />
                             <AuthorizedHospitalItem name="City Hospital" access="Limited Access" />
                             <AuthorizedHospitalItem name="Max Healthcare" access="Read-Only" />
                         </ul>
                     </Card>
                </div>

                <div className="space-y-6">
                    <Card title="Quick Health Info">
                        <QuickInfoItem icon="🔺" label="Allergies" value="Penicillin, Nuts" color="text-red-500" />
                        <QuickInfoItem icon="❤️" label="Chronic Conditions" value="Diabetes, HTN" color="text-red-600" />
                        <QuickInfoItem icon="💊" label="Active Medications" value="2 medicines" color="text-yellow-500" />
                        <QuickInfoItem icon="📋" label="Recent Consultations" value="3 (Last: 15-Oct)" color="text-blue-500" />
                    </Card>
                    <Card title="Hospital Access History">
                        <ul className="divide-y divide-gray-200 text-sm">
                            <li className="py-2">Apollo Hospital - 15-Oct-2024</li>
                            <li className="py-2">City Hospital - 28-Sep-2024</li>
                            <li className="py-2">Max Healthcare - 10-Aug-2024</li>
                        </ul>
                        <button onClick={() => alert('Viewing all hospital accesses - TBI')} className="text-sm text-brand-accent hover:underline mt-2 w-full text-right">View All Accesses</button>
                    </Card>
                </div>
            </div>
        </div>
    );
};

export default PatientDashboard;