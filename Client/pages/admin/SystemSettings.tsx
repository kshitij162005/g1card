import React from 'react';
import Card from '../../components/Card';

const SettingInput: React.FC<{ label: string; id: string; type?: string; value: string | number }> = ({ label, id, type = 'text', value }) => (
    <div>
        <label htmlFor={id} className="block text-sm font-medium text-slate-700 dark:text-slate-300">{label}</label>
        <input type={type} id={id} defaultValue={value} className="mt-1 block w-full border border-slate-300 dark:border-slate-600 rounded-lg shadow-sm py-2 px-3 focus:outline-none focus:ring-brand-accent focus:border-brand-accent"/>
    </div>
);

const Section: React.FC<{ title: string; children: React.ReactNode }> = ({ title, children }) => (
    <div className="space-y-6">
        <h3 className="text-lg font-semibold text-slate-900 dark:text-slate-100">{title}</h3>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {children}
        </div>
    </div>
);

const SystemSettings: React.FC = () => {
    return (
        <Card title="System Settings & Configuration">
            <form className="space-y-8 divide-y divide-slate-200 dark:divide-slate-700">
                <Section title="General Settings">
                   <SettingInput label="System Name" id="system-name" value="G1CARD" />
                   <SettingInput label="Support Email" id="support-email" type="email" value="kotechakshitij@gmail.com" />
                   <SettingInput label="Timezone" id="timezone" value="IST (UTC+5:30)" />
                   <SettingInput label="Language" id="language" value="English" />
                </Section>

                <div className="pt-8">
                    <Section title="Email Configuration">
                        <SettingInput label="Email Service" id="email-service" value="Nodemailer" />
                        <SettingInput label="SMTP Host" id="smtp-host" value="smtp.gmail.com" />
                        <SettingInput label="Sender Email" id="sender-email" value="noreply@g1card.com" />
                    </Section>
                </div>
                
                 <div className="pt-8">
                    <Section title="OTP Settings">
                        <SettingInput label="OTP Length" id="otp-length" type="number" value={6} />
                        <SettingInput label="OTP Validity (minutes)" id="otp-validity" type="number" value={10} />
                        <SettingInput label="Resend Cooldown (seconds)" id="resend-cooldown" type="number" value={30} />
                        <SettingInput label="Max Attempts" id="max-attempts" type="number" value={5} />
                    </Section>
                </div>

                 <div className="pt-8">
                     <Section title="Security Settings">
                        <SettingInput label="Session Timeout (minutes)" id="session-timeout" type="number" value={30} />
                        <SettingInput label="JWT Expiry (hours)" id="jwt-expiry" type="number" value={24} />
                        <SettingInput label="Password Min Length" id="password-min-length" type="number" value={6} />
                    </Section>
                </div>

                <div className="pt-8 flex justify-end">
                    <button type="submit" className="px-6 py-2 bg-brand-primary text-white font-semibold rounded-lg hover:bg-brand-secondary transition-transform transform hover:scale-105">
                        Save Changes
                    </button>
                </div>
            </form>
        </Card>
    );
};

export default SystemSettings;