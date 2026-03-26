import { API_URL } from '../config/api';

import React, { createContext, useState, useContext, ReactNode } from 'react';
import { User, Role } from '../types';

interface AuthContextType {
    user: User | null;
    login: (role: Role, email: string, password: string) => Promise<boolean>;
    loginWithGoogle: (role: Role, idToken: string) => Promise<boolean>;
    loginSimulation: (role: Role) => Promise<boolean>;
    logout: () => void;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
    const [user, setUser] = useState<User | null>(() => {
        // Initialize from localStorage on mount
        const savedUser = localStorage.getItem('g1card_user');
        if (savedUser) {
            try {
                return JSON.parse(savedUser);
            } catch (e) {
                console.error('Error parsing saved user', e);
                return null;
            }
        }
        return null;
    });

    const login = async (role: Role, email: string, password: string) => {
        try {
            const resp = await fetch(`${API_URL}/auth/login`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ role: role, email, password }),
            });
            const data = await resp.json();
            if (!resp.ok) {
                console.warn('login failed', data);
                return false;
            }
            const u = data.user;
            const newUser: User = {
                id: u.id,
                email: u.email,
                name: u.name,
                role: role,
                isSimulation: false,
                lastLogin: new Date().toISOString(),
                lastAccess: u.lastAccess || new Date().toISOString(),
            };
            setUser(newUser);
            // Persist to localStorage
            localStorage.setItem('g1card_user', JSON.stringify(newUser));
            return true;
        } catch (err) {
            console.error('login error', err);
            return false;
        }
    };

    const loginWithGoogle = async (role: Role, idToken: string) => {
        try {
            const resp = await fetch(`${API_URL}/auth/google`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ role, idToken }),
            });
            const data = await resp.json();
            if (!resp.ok) {
                console.warn('google login failed', data);
                throw new Error(data?.error || data?.message || 'Google sign-in failed');
            }

            const u = data.user;
            const newUser: User = {
                id: u.id,
                email: u.email,
                name: u.name,
                role: role,
                isSimulation: false,
                lastLogin: new Date().toISOString(),
                lastAccess: u.lastAccess || new Date().toISOString(),
            };

            setUser(newUser);
            localStorage.setItem('g1card_user', JSON.stringify(newUser));
            return true;
        } catch (err) {
            console.error('google login error', err);
            throw err;
        }
    };

    const loginSimulation = async (role: Role) => {
        try {
            const resp = await fetch(`${API_URL}/auth/simulation-login`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ role }),
            });
            const data = await resp.json();
            if (!resp.ok) {
                console.warn('simulation login failed', data);
                return false;
            }

            const u = data.user;
            const newUser: User = {
                id: u.id,
                email: u.email,
                name: u.name,
                role,
                isSimulation: true,
                lastLogin: new Date().toISOString(),
                lastAccess: u.lastAccess || new Date().toISOString(),
            };

            setUser(newUser);
            localStorage.setItem('g1card_user', JSON.stringify(newUser));
            return true;
        } catch (err) {
            console.error('simulation login error', err);
            return false;
        }
    };

    const logout = () => {
        setUser(null);
        // Clear from localStorage
        localStorage.removeItem('g1card_user');
    };

    return (
        <AuthContext.Provider value={{ user, login, loginWithGoogle, loginSimulation, logout }}>
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
