
import React from 'react';
import { HashRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider, useAuth } from './contexts/AuthContext';
import { Role } from './types';
import LoginPage from './pages/LoginPage';
import OtpPage from './pages/OtpPage';
import ForgotPasswordPage from './pages/ForgotPasswordPage';
import ResetPasswordPage from './pages/ResetPasswordPage';
import HospitalRegistrationPage from './pages/hospital/HospitalRegistrationPage';
import HospitalOtpPage from './pages/hospital/HospitalOtpPage';
import PatientRegistrationPage from './pages/patient/PatientRegistrationPage';
import PatientOtpPage from './pages/patient/PatientOtpPage';


import AuthLayout from './layouts/AuthLayout';
import AdminLayout from './layouts/AdminLayout';
import AdminDashboard from './pages/admin/AdminDashboard';
import HospitalManagement from './pages/admin/HospitalManagement';
import HospitalDetails from './pages/admin/HospitalDetails';
import UserManagement from './pages/admin/UserManagement';
import SystemSettings from './pages/admin/SystemSettings';
import AuditLogs from './pages/admin/AuditLogs';
import AddHospitalPage from './pages/admin/AddHospitalPage';

import HospitalLayout from './layouts/HospitalLayout';
import HospitalDashboard from './pages/hospital/HospitalDashboard';
import HospitalPatientManagement from './pages/hospital/PatientManagement';
import HospitalStaffManagement from './pages/hospital/StaffManagement';
import PatientRecord from './pages/hospital/PatientRecord';
import AddEditMedicalRecord from './pages/hospital/AddEditMedicalRecord';
import FormTemplatesList from './pages/hospital/FormTemplatesList';
import FormDetails from './pages/hospital/FormDetails';
import CreateForm from './pages/hospital/CreateForm';
import AddPatientPage from './pages/hospital/AddPatientPage';
import EditPatientPage from './pages/hospital/EditPatientPage';
import ReportsPage from './pages/hospital/ReportsPage';
import HospitalSettingsPage from './pages/hospital/HospitalSettingsPage';
import AddStaffPage from './pages/hospital/AddStaffPage';
import StaffDetailsPage from './pages/hospital/StaffDetailsPage';


import PatientLayout from './layouts/PatientLayout';
import PatientDashboard from './pages/patient/PatientDashboard';
import HealthHistory from './pages/patient/HealthHistory';
import PatientSettings from './pages/patient/PatientSettings';


const AppRoutes: React.FC = () => {
    const { user } = useAuth();

    if (!user) {
        return (
            <Routes>
                <Route element={<AuthLayout />}>
                    <Route path="/login" element={<LoginPage />} />
                    <Route path="/otp" element={<OtpPage />} />
                    <Route path="/forgot-password" element={<ForgotPasswordPage />} />
                    <Route path="/reset-password" element={<ResetPasswordPage />} />
                    <Route path="/hospital/register" element={<HospitalRegistrationPage />} />
                    <Route path="/hospital/verify-otp" element={<HospitalOtpPage />} />
                    <Route path="/patient/register" element={<PatientRegistrationPage />} />
                    <Route path="/patient/verify-otp" element={<PatientOtpPage />} />
                    <Route path="*" element={<Navigate to="/login" />} />
                </Route>
            </Routes>
        );
    }
    
    switch (user.role) {
        case Role.SUPER_ADMIN:
            return (
                <Routes>
                    <Route path="/admin" element={<AdminLayout />}>
                        <Route index element={<Navigate to="dashboard" />} />
                        <Route path="dashboard" element={<AdminDashboard />} />
                        <Route path="hospitals" element={<HospitalManagement />} />
                        <Route path="hospitals/add" element={<AddHospitalPage />} />
                        <Route path="hospitals/:id" element={<HospitalDetails />} />
                        <Route path="users" element={<UserManagement />} />
                        <Route path="settings" element={<SystemSettings />} />
                        <Route path="logs" element={<AuditLogs />} />
                    </Route>
                    <Route path="*" element={<Navigate to="/admin/dashboard" />} />
                </Routes>
            );
        case Role.HOSPITAL:
             return (
                 <Routes>
                    <Route path="/hospital" element={<HospitalLayout />}>
                        <Route index element={<Navigate to="dashboard" />} />
                        <Route path="dashboard" element={<HospitalDashboard />} />
                        <Route path="patients" element={<HospitalPatientManagement />} />
                        <Route path="patients/add" element={<AddPatientPage />} />
                        <Route path="patients/:patientId" element={<PatientRecord />} />
                        <Route path="patients/:patientId/edit" element={<EditPatientPage />} />
                        <Route path="patients/:patientId/add-record" element={<AddEditMedicalRecord />} />
                        <Route path="forms" element={<FormTemplatesList />} />
                        <Route path="forms/create" element={<CreateForm />} />
                        <Route path="forms/:formId/edit" element={<CreateForm />} />
                        <Route path="forms/:formId" element={<FormDetails />} />
                        <Route path="staff" element={<HospitalStaffManagement />} />
                        <Route path="staff/add" element={<AddStaffPage />} />
                        <Route path="staff/:staffId" element={<StaffDetailsPage />} />
                        <Route path="reports" element={<ReportsPage />} />
                        <Route path="settings" element={<HospitalSettingsPage />} />
                    </Route>
                    <Route path="*" element={<Navigate to="/hospital/dashboard" />} />
                </Routes>
            );
        case Role.PATIENT:
            return (
                <Routes>
                    <Route path="/patient" element={<PatientLayout />}>
                        <Route index element={<Navigate to="dashboard" />} />
                        <Route path="dashboard" element={<PatientDashboard />} />
                        <Route path="health-history" element={<HealthHistory />} />
                        <Route path="settings" element={<PatientSettings />} />
                    </Route>
                    <Route path="*" element={<Navigate to="/patient/dashboard" />} />
                </Routes>
            );
        default:
             return <Navigate to="/login" />;
    }
}


const App: React.FC = () => {
  return (
    <AuthProvider>
        <HashRouter>
            <AppRoutes/>
        </HashRouter>
    </AuthProvider>
  );
};

export default App;