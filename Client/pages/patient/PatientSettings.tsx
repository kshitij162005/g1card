import React from 'react';
import Card from '../../components/Card';

const Section: React.FC<{ title: string; children: React.ReactNode; }> = ({ title, children }) => (
    <div className="py-6">
        <h3 className="text-lg font-semibold text-slate-900 dark:text-slate-100 mb-4">{title}</h3>
        <div className="space-y-4">{children}</div>
    </div>
);

const ToggleSwitch: React.FC<{ label: string; defaultChecked?: boolean; disabled?: boolean; comingSoon?: boolean; }> = ({ label, defaultChecked, disabled, comingSoon }) => (
    <label className={`flex items-center justify-between ${disabled ? 'cursor-not-allowed opacity-60' : 'cursor-pointer'}`}>
        <span className="text-sm font-medium text-slate-800 dark:text-slate-200">
            {label} {comingSoon && <span className="text-xs text-brand-accent ml-2">(Coming Soon)</span>}
        </span>
        <div className="relative inline-flex items-center h-6 rounded-full w-11">
            <input type="checkbox" className="sr-only peer" defaultChecked={defaultChecked} disabled={disabled} />
            <div className="w-11 h-6 bg-slate-200 dark:bg-slate-600 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-0.5 after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-brand-accent"></div>
        </div>
    </label>
);


const PermissionControl: React.FC<{ hospital: string; access: string; lastAccessed: string; }> = ({ hospital, access, lastAccessed }) => (
    <div className="p-4 border dark:border-slate-700 rounded-lg bg-slate-50 dark:bg-slate-700/50 flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
            <p className="font-semibold text-slate-800 dark:text-slate-200">{hospital}</p>
            <p className="text-xs text-slate-500 dark:text-slate-400">Last Accessed: {lastAccessed}</p>
        </div>
        <div className="flex items-center gap-4">
             <select defaultValue={access} className="text-sm border-slate-300 dark:border-slate-600 rounded-lg focus:ring-brand-accent focus:border-brand-accent">
                 <option>Full Access</option>
                 <option>Limited</option>
                 <option>Read-only</option>
             </select>
             <button className="text-sm text-red-600 hover:underline font-semibold">Revoke Access</button>
        </div>
    </div>
);

const ActiveSession: React.FC<{ browser: string; location: string; lastActive: string; }> = ({ browser, location, lastActive }) => (
    <div className="p-3 border dark:border-slate-700 rounded-lg flex items-center justify-between">
        <p className="text-sm text-slate-800 dark:text-slate-200"><strong>{browser}</strong> - {location}</p>
        <div className="flex items-center gap-4">
            <p className="text-xs text-slate-500 dark:text-slate-400">Last active: {lastActive}</p>
            <button className="text-sm text-red-600 hover:underline">Sign Out</button>
        </div>
    </div>
);

const PatientSettings: React.FC = () => {
    return (
        <Card title="Account Settings & Privacy">
            <div className="divide-y divide-slate-200 dark:divide-slate-700">
                <Section title="Profile Information">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
                        <p><strong>Name:</strong> John Doe</p>
                        <p><strong>Email:</strong> john@example.com <span className="text-green-600">(Verified ✓)</span></p>
                        <p><strong>Phone:</strong> +91-9876543210</p>
                        <p><strong>DOB:</strong> 15-05-1990</p>
                    </div>
                    <div className="flex gap-2 mt-4">
                        <button className="px-4 py-2 bg-slate-200 dark:bg-slate-700 text-slate-800 dark:text-slate-200 text-sm rounded-lg hover:bg-slate-300 dark:hover:bg-slate-600">Edit Profile</button>
                        <button className="px-4 py-2 bg-slate-200 dark:bg-slate-700 text-slate-800 dark:text-slate-200 text-sm rounded-lg hover:bg-slate-300 dark:hover:bg-slate-600">Change Email</button>
                    </div>
                </Section>
                
                <Section title="Hospital Permissions">
                    <p className="text-sm text-slate-600 dark:text-slate-400">Manage which hospitals can access your data.</p>
                    <PermissionControl hospital="Apollo Hospital" access="Full Access" lastAccessed="15-Oct-2024" />
                    <PermissionControl hospital="City Hospital" access="Limited" lastAccessed="28-Sep-2024" />
                    <PermissionControl hospital="Max Healthcare" access="Read-only" lastAccessed="10-Aug-2024" />
                    <button className="text-sm px-4 py-2 border border-dashed border-slate-400 dark:border-slate-600 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300">+ Add New Hospital</button>
                </Section>

                <Section title="Security Settings">
                    <div>
                        <p className="text-sm"><strong>Password:</strong> •••••••• <span className="text-xs text-slate-500 ml-4">Last Changed: 15 days ago</span></p>
                        <button className="mt-2 px-4 py-2 bg-slate-200 dark:bg-slate-700 text-slate-800 dark:text-slate-200 text-sm rounded-lg hover:bg-slate-300 dark:hover:bg-slate-600">Change Password</button>
                    </div>
                   <ToggleSwitch label="Two-Factor Authentication" disabled comingSoon />
                </Section>
                
                <Section title="Active Sessions">
                    <ActiveSession browser="Web Browser (Chrome)" location="Mumbai, IN" lastActive="2 hours ago" />
                    <ActiveSession browser="Mobile (iPhone)" location="Mumbai, IN" lastActive="1 day ago" />
                    <button className="w-full mt-2 px-4 py-2 bg-red-50 dark:bg-red-900/20 border-red-200 dark:border-red-900/30 border text-red-700 dark:text-red-400 text-sm rounded-lg hover:bg-red-100 dark:hover:bg-red-900/40">Sign Out All Sessions</button>
                </Section>

                <Section title="Privacy & Data">
                     <div className="space-y-3">
                        <ToggleSwitch label="Allow hospitals to update my records" defaultChecked />
                        <ToggleSwitch label="Share medical history for emergency" defaultChecked />
                        <ToggleSwitch label="Allow anonymous data for research" />
                    </div>
                    <div className="flex flex-col md:flex-row justify-between items-center pt-4 border-t dark:border-slate-700 mt-6">
                        <div>
                             <h4 className="font-semibold text-slate-800 dark:text-slate-200">Download Your Data</h4>
                             <button className="mt-1 px-4 py-2 bg-slate-200 dark:bg-slate-700 text-slate-800 dark:text-slate-200 text-sm rounded-lg hover:bg-slate-300 dark:hover:bg-slate-600">Download Data Export (PDF/JSON)</button>
                        </div>
                        <div className="mt-4 md:mt-0">
                             <h4 className="font-semibold text-red-700 dark:text-red-400">Data Deletion Request</h4>
                             <button className="mt-1 px-4 py-2 bg-red-50 dark:bg-red-900/20 text-red-700 dark:text-red-400 text-sm rounded-lg hover:bg-red-100 dark:hover:bg-red-900/40">Request Account Deletion</button>
                        </div>
                    </div>
                </Section>

                <Section title="Notification Preferences">
                    <div className="space-y-3">
                        <ToggleSwitch label="Email when hospitals access records" defaultChecked />
                        <ToggleSwitch label="Email for new prescriptions" defaultChecked />
                        <ToggleSwitch label="Email for consultation reminders" defaultChecked />
                    </div>
                </Section>

                 <div className="pt-8 flex justify-end space-x-4">
                    <button type="button" className="px-6 py-2 border border-slate-300 dark:border-slate-600 rounded-lg shadow-sm text-sm font-medium text-slate-700 dark:text-slate-200 bg-white dark:bg-transparent hover:bg-slate-50 dark:hover:bg-slate-700">
                        Cancel
                    </button>
                     <button type="submit" className="px-6 py-2 border border-transparent rounded-lg shadow-sm text-sm font-medium text-white bg-brand-primary hover:bg-brand-secondary">
                        Save All Changes
                    </button>
                </div>
            </div>
        </Card>
    );
};

export default PatientSettings;