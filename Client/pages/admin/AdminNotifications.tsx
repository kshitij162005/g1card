import React from 'react';
import { API_URL } from '../../config/api';
import { useAuth } from '../../contexts/AuthContext';
import NotificationInbox from '../../components/NotificationInbox';

const AdminNotifications: React.FC = () => {
    const { user } = useAuth();
    if (!user?.id) return null;

    return (
        <NotificationInbox
            kicker="Control centre"
            subtitle="Deletion requests from patients, hospital detail changes and other things that need an admin."
            baseUrl={`${API_URL}/superadmin/admins/${user.id}/notifications`}
            mutatingButtonProps={{ 'data-simulation-block': 'true' }}
            linkFor={(n) => {
                if (n.metadata?.source === 'PATIENT_DELETION_REQUEST') return { label: 'Review request', to: '/admin/deletion-requests' };
                if (/UPDATE/.test(n.type)) return { label: 'Review update', to: '/admin/update-requests' };
                if (n.metadata?.hospitalId) return { label: 'Open hospital', to: `/admin/hospitals/${n.metadata.hospitalId}` };
                return null;
            }}
        />
    );
};

export default AdminNotifications;
