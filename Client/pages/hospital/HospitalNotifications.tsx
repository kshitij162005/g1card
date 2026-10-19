import React from 'react';
import { API_URL } from '../../config/api';
import { useAuth } from '../../contexts/AuthContext';
import NotificationInbox from '../../components/NotificationInbox';

const HospitalNotifications: React.FC = () => {
    const { user } = useAuth();
    if (!user?.id) return null;

    return (
        <NotificationInbox
            kicker="Inbox"
            subtitle="Patient decisions on your access requests, access changes and replies about your hospital details."
            baseUrl={`${API_URL}/hospitals/${user.id}/notifications`}
            linkFor={(n) => {
                // Access decisions are sent by the patient, so the sender is the patient to open
                const patientId = n.metadata?.patientId || (/^ACCESS_/.test(n.type) ? n.sender?._id : undefined);
                if (patientId && /^ACCESS_/.test(n.type)) return { label: 'Open patient', to: `/hospital/patients/${patientId}` };
                if (/UPDATE/.test(n.type)) return { label: 'Hospital details', to: '/hospital/settings' };
                return null;
            }}
        />
    );
};

export default HospitalNotifications;
