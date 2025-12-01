
export enum Role {
    SUPER_ADMIN = 'Super Admin',
    HOSPITAL = 'Hospital',
    PATIENT = 'Patient',
}

export interface User {
    id: string;
    email: string;
    name: string;
    role: Role;
    lastLogin?: string;
    lastAccess?: string;
}

export enum HospitalStatus {
    ACTIVE = 'Active',
    PENDING = 'Pending',
    INACTIVE = 'Inactive',
}

export interface Hospital {
    id: string;
    name: string;
    location: string;
    status: HospitalStatus;
    registrationDate: string;
}

export interface SystemUser extends User {
    status: 'Active' | 'Inactive';
    createdDate: string;
}

export interface AuditLog {
    id: string;
    timestamp: string;
    user: string;
    userRole: Role;
    action: string;
    status: 'Success' | 'Failure';
}

export enum PatientStatus {
    ACTIVE = 'Active',
    INACTIVE = 'Inactive',
}

export interface Patient {
    id: string;
    name: string;
    dob: string;
    status: PatientStatus;
}

// Detailed Patient View Types
export interface Allergy {
    name: string;
    severity: string;
}

export interface ChronicCondition {
    name: string;
    diagnosed: string;
}

export interface Medication {
    name: string;
    dosage: string;
    since: string;
    prescribedBy: string;
}

export interface SurgeryInjury {
    name: string;
    date: string;
    hospital: string;
    doctor: string;
    treatment: string;
}

export interface Immunization {
    name: string;
    date: string;
}

export interface Consultation {
    date: string;
    hospital: string;
    doctor: string;
    reason: string;
}

export interface MedicalDocument {
    name: string;
    date: string;
    type: 'pdf' | 'jpg';
}

export interface DetailedPatient {
    id: string;
    name: string;
    dob: string;
    age: number;
    gender: string;
    contact: string;
    email: string;
    address: string;
    bloodGroup: string;
    height: string;
    weight: string;
    bmi: string;
    allergies: Allergy[];
    chronicConditions: ChronicCondition[];
    currentMedications: Medication[];
    previousSurgeries: SurgeryInjury[];
    immunizationRecords: Immunization[];
    consultationHistory: Consultation[];
    uploadedDocuments: MedicalDocument[];
    lastUpdated: string;
    created: string;
}

export enum StaffRole {
    DOCTOR = 'Doctor',
    NURSE = 'Nurse',
    ADMIN = 'Admin',
}

export interface Staff {
    id: string;
    name: string;
    email: string;
    role: StaffRole;
    status: 'Active' | 'Inactive';
}
