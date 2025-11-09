
import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';

const ResetPasswordPage: React.FC = () => {
    const [password, setPassword] = useState('');
    const [confirmPassword, setConfirmPassword] = useState('');
    const [strength, setStrength] = useState(0);
    const navigate = useNavigate();
    
    const checkStrength = (value: string) => {
        let score = 0;
        if (value.length >= 6) score++;
        if (/[A-Z]/.test(value)) score++;
        if (/[0-9]/.test(value)) score++;
        if (/[^A-Za-z0-9]/.test(value)) score++;
        setStrength(score * 25);
    };

    const handlePasswordChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        setPassword(e.target.value);
        checkStrength(e.target.value);
    };

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        if (password !== confirmPassword) {
            alert("Passwords do not match.");
            return;
        }
        alert("Password has been updated successfully.");
        navigate('/login');
    };

    const getStrengthColor = () => {
        if (strength < 50) return 'bg-red-500';
        if (strength < 75) return 'bg-yellow-500';
        return 'bg-green-500';
    };

    return (
        <div className="min-h-screen flex items-center justify-center p-4 relative overflow-hidden">
            <div className="absolute top-0 left-0 -translate-x-1/4 -translate-y-1/4 w-96 h-96 bg-brand-accent/20 dark:bg-brand-accent/30 rounded-full blur-3xl"></div>
            <div className="absolute bottom-0 right-0 translate-x-1/4 translate-y-1/4 w-96 h-96 bg-brand-primary/20 dark:bg-brand-primary/30 rounded-full blur-3xl delay-500"></div>
            <div className="w-full max-w-md p-8 space-y-6 bg-white/80 dark:bg-slate-800/80 backdrop-blur-lg rounded-2xl shadow-xl border border-slate-200 dark:border-slate-700 z-10">
                <div className="text-center">
                    <h2 className="text-2xl font-bold text-slate-800 dark:text-white">Create New Password</h2>
                </div>
                <ul className="text-xs text-slate-500 dark:text-slate-400 list-disc list-inside space-y-1">
                    <li>Minimum 6 characters</li>
                    <li>Minimum 1 uppercase letter</li>
                    <li>Minimum 1 number</li>
                </ul>
                <form onSubmit={handleSubmit} className="space-y-4">
                    <div>
                        <input
                            type="password"
                            value={password}
                            onChange={handlePasswordChange}
                            placeholder="New Password"
                            className="w-full px-3 py-2 border border-slate-300 dark:border-slate-600 rounded-lg focus:ring-brand-accent focus:border-brand-accent bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100 placeholder:text-slate-400 dark:placeholder:text-slate-500"
                            required
                        />
                        <div className="w-full bg-slate-200 dark:bg-slate-700 rounded-full h-1.5 mt-2">
                            <div className={`h-1.5 rounded-full ${getStrengthColor()}`} style={{ width: `${strength}%` }}></div>
                        </div>
                        <p className="text-xs text-right mt-1 text-slate-500 dark:text-slate-400">{strength}% Strong</p>
                    </div>
                    <input
                        type="password"
                        value={confirmPassword}
                        onChange={(e) => setConfirmPassword(e.target.value)}
                        placeholder="Confirm Password"
                        className="w-full px-3 py-2 border border-slate-300 dark:border-slate-600 rounded-lg focus:ring-brand-accent focus:border-brand-accent bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100 placeholder:text-slate-400 dark:placeholder:text-slate-500"
                        required
                    />
                    <button type="submit" className="w-full py-2.5 px-4 border border-transparent rounded-lg shadow-sm text-sm font-medium text-white bg-brand-primary hover:bg-brand-secondary transition-transform transform hover:scale-105">
                        Update Password
                    </button>
                </form>
            </div>
        </div>
    );
};

export default ResetPasswordPage;