import React from 'react';
import { Outlet } from 'react-router-dom';
import ThemeToggle from '../components/ThemeToggle';

const AuthLayout: React.FC = () => {
    return (
        <div className="relative min-h-screen">
            <div className="absolute top-4 right-4 z-20">
                <ThemeToggle />
            </div>
            <main>
                <Outlet />
            </main>
        </div>
    );
};

export default AuthLayout;
