
import React, { createContext, useState, useContext, ReactNode } from 'react';
import { User, Role } from '../types';

interface AuthContextType {
    user: User | null;
    login: (role: Role, email: string) => void;
    logout: () => void;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
    const [user, setUser] = useState<User | null>(null);

    const login = (role: Role, email: string) => {
        // Mock login logic
        let name = "Admin User";
        if (role === Role.HOSPITAL) name = "Hospital Admin";
        if (role === Role.PATIENT) name = "Patient User";
        
        const mockUser: User = {
            id: '1',
            email: email,
            role: role,
            name: name,
            lastLogin: '2 hours ago',
        };
        setUser(mockUser);
    };

    const logout = () => {
        setUser(null);
    };

    return (
        <AuthContext.Provider value={{ user, login, logout }}>
            {children}
        </AuthContext.Provider>
    );
};

export const useAuth = () => {
    const context = useContext(AuthContext);
    if (context === undefined) {
        throw new Error('useAuth must be used within an AuthProvider');
    }
    return context;
};
