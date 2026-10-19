import React, { useEffect, useState } from 'react';
import { API_URL } from '../../config/api';
import { useAuth } from '../../contexts/AuthContext';
import { SettingsPage, SettingsSection, SettingRow, InfoGrid, Switch, StatusPill } from '../../components/settings/Settings';
import { DialogButton } from '../../components/AppDialog';
import { ThemeMode, getStoredTheme, setStoredTheme } from '../../utils/theme';

interface SystemInfo {
    environment: string;
    appUrl: string;
    database: { connected: boolean; name: string };
    email: { configured: boolean; via: string; sender: string };
    googleSignIn: { configured: boolean };
    ai: { routing: string; providers: Array<{ name: string; configured: boolean; models: number }> };
    otp: { length: number; validityMinutes: number; resendCooldownSeconds: number };
    uptimeSeconds: number;
}

const uptime = (s: number) => {
    const d = Math.floor(s / 86400), h = Math.floor((s % 86400) / 3600), m = Math.floor((s % 3600) / 60);
    return d ? `${d} d ${h} h` : h ? `${h} h ${m} min` : `${m} min`;
};

// Live view of how the platform is configured. Values come from the server's environment, so they
// are read-only here; change them in the server's .env and restart.
const SystemSettings: React.FC = () => {
    const { user } = useAuth();
    const [info, setInfo] = useState<SystemInfo | null>(null);
    const [error, setError] = useState('');
    const [loading, setLoading] = useState(true);
    const [theme, setTheme] = useState<ThemeMode>(() => getStoredTheme());

    const load = async () => {
        setLoading(true);
        setError('');
        try {
            const resp = await fetch(`${API_URL}/superadmin/system`);
            const data = await resp.json();
            if (!resp.ok) throw new Error(data?.error || 'Could not load configuration');
            setInfo(data.system);
        } catch (err: any) {
            setError(err?.message || 'Could not load configuration');
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => { load(); }, []);

    const ok = (v: boolean, yes = 'Connected', no = 'Not set up') => <StatusPill tone={v ? 'ok' : 'bad'}>{v ? yes : no}</StatusPill>;
    const configuredAi = info?.ai.providers.filter(p => p.configured) || [];

    return (
        <SettingsPage
            kicker="Control centre"
            title="Settings"
            subtitle="How G1Card is set up right now. Platform values come from the server environment."
            actions={<DialogButton onClick={load} disabled={loading}>{loading ? 'Checking…' : 'Check again'}</DialogButton>}
        >
            {error && <p className="st-note st-note--bad">{error}</p>}

            <SettingsSection title="Your admin account" description="How the admin portal looks for you on this device.">
                <InfoGrid items={[{ label: 'Signed in as', value: user?.email }, { label: 'Role', value: 'Super admin' }]} />
                <SettingRow title="Dark mode" description="Saved on this device.">
                    <Switch
                        label="Dark mode"
                        checked={theme === 'dark'}
                        onChange={(on) => { const next: ThemeMode = on ? 'dark' : 'light'; setStoredTheme(next); setTheme(next); }}
                    />
                </SettingRow>
            </SettingsSection>

            <SettingsSection title="Services" description="If something here isn’t set up, the matching feature (emails, Google sign-in, Golu) won’t work.">
                <SettingRow title="Database" description={info?.database.name ? `MongoDB · ${info.database.name}` : 'MongoDB'}>
                    {info ? ok(info.database.connected) : <StatusPill tone="muted">…</StatusPill>}
                </SettingRow>
                <SettingRow title="Email delivery" description={info?.email.configured ? `Sends from ${info.email.sender} via ${info.email.via}` : 'OTP codes and alerts can’t be emailed until SMTP is configured.'}>
                    {info ? ok(info.email.configured) : <StatusPill tone="muted">…</StatusPill>}
                </SettingRow>
                <SettingRow title="Google sign-in" description="Lets patients and hospitals sign in with Google.">
                    {info ? ok(info.googleSignIn.configured, 'Enabled', 'Off') : <StatusPill tone="muted">…</StatusPill>}
                </SettingRow>
                <SettingRow
                    title="AI assistant (Golu)"
                    description={info ? (configuredAi.length ? `${configuredAi.map(p => p.name).join(', ')} · ${info.ai.routing} routing` : 'No AI provider key is set.') : ''}
                >
                    {info ? ok(configuredAi.length > 0, `${configuredAi.length} provider${configuredAi.length === 1 ? '' : 's'}`, 'Off') : <StatusPill tone="muted">…</StatusPill>}
                </SettingRow>
            </SettingsSection>

            <SettingsSection title="Sign-in codes" description="One-time codes for registration and password changes.">
                <InfoGrid items={[
                    { label: 'Code length', value: info ? `${info.otp.length} digits` : '' },
                    { label: 'Valid for', value: info ? `${info.otp.validityMinutes} minutes` : '' },
                    { label: 'Resend after', value: info ? `${info.otp.resendCooldownSeconds} seconds` : '' },
                ]} />
            </SettingsSection>

            <SettingsSection title="Deployment">
                <InfoGrid items={[
                    { label: 'Environment', value: info?.environment },
                    { label: 'Links in emails point to', value: info?.appUrl },
                    { label: 'Server running for', value: info ? uptime(info.uptimeSeconds) : '' },
                    { label: 'Support email', value: 'kotechakshitij@gmail.com' },
                ]} />
            </SettingsSection>
        </SettingsPage>
    );
};

export default SystemSettings;
