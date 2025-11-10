import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { Role } from '../types';

const LoginPage: React.FC = () => {
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [role, setRole] = useState<Role>(Role.SUPER_ADMIN);
    const [showPassword, setShowPassword] = useState(false);
    const navigate = useNavigate();
    const { login } = useAuth();

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        const ok = await login(role, email, password);
        if (!ok) {
            alert('Login failed. Check credentials.');
            return;
        }
        switch (role) {
            case Role.SUPER_ADMIN:
                navigate('/admin/dashboard');
                break;
            case Role.HOSPITAL:
                navigate('/hospital/dashboard');
                break;
            case Role.PATIENT:
                navigate('/patient/dashboard');
                break;
            default:
                navigate('/login');
        }
    };

    return (
        <div className="min-h-screen flex items-center justify-center p-4 relative overflow-hidden">
             <div className="absolute top-0 left-0 -translate-x-1/4 -translate-y-1/4 w-96 h-96 bg-brand-accent/20 dark:bg-brand-accent/30 rounded-full blur-3xl"></div>
            <div className="absolute bottom-0 right-0 translate-x-1/4 translate-y-1/4 w-96 h-96 bg-brand-primary/20 dark:bg-brand-primary/30 rounded-full blur-3xl delay-500"></div>

            <div className="w-full max-w-md p-8 space-y-6 bg-white/80 dark:bg-slate-800/80 backdrop-blur-lg rounded-2xl shadow-xl border border-slate-200 dark:border-slate-700 z-10">
                <div className="text-center">
                    <h1 className="text-3xl font-bold text-brand-primary dark:text-white">G1CARD</h1>
                    <p className="text-slate-500 dark:text-slate-400">Medical Records Unified</p>
                </div>
                <form onSubmit={handleSubmit} className="space-y-6">
                    <div>
                        <label htmlFor="email" className="text-sm font-medium text-slate-700 dark:text-slate-300">Email Address</label>
                        <input
                            id="email"
                            type="email"
                            value={email}
                            onChange={(e) => setEmail(e.target.value)}
                            className="mt-1 block w-full px-3 py-2 border border-slate-300 dark:border-slate-600 rounded-lg shadow-sm placeholder:text-slate-400 dark:placeholder:text-slate-500 focus:outline-none focus:ring-brand-accent focus:border-brand-accent sm:text-sm bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100"
                            required
                        />
                    </div>
                    <div className="relative">
                        <label htmlFor="password"  className="text-sm font-medium text-slate-700 dark:text-slate-300">Password</label>
                        <input
                            id="password"
                            type={showPassword ? 'text' : 'password'}
                            value={password}
                            onChange={(e) => setPassword(e.target.value)}
                            className="mt-1 block w-full px-3 py-2 border border-slate-300 dark:border-slate-600 rounded-lg shadow-sm placeholder:text-slate-400 dark:placeholder:text-slate-500 focus:outline-none focus:ring-brand-accent focus:border-brand-accent sm:text-sm bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100"
                            required
                        />
                        <button type="button" onClick={() => setShowPassword(!showPassword)} className="absolute inset-y-0 right-0 top-6 pr-3 flex items-center text-sm leading-5">
                             {showPassword ? (
                                <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 text-slate-500 dark:text-slate-400" viewBox="0 0 20 20" fill="currentColor"><path d="M10 12a2 2 0 100-4 2 2 0 000 4z" /><path fillRule="evenodd" d="M.458 10C1.732 5.943 5.522 3 10 3s8.268 2.943 9.542 7c-1.274 4.057-5.022 7-9.542 7S1.732 14.057.458 10zM14 10a4 4 0 11-8 0 4 4 0 018 0z" clipRule="evenodd" /></svg>
                             ) : (
                                <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 text-slate-500 dark:text-slate-400" viewBox="0 0 20 20" fill="currentColor"><path fillRule="evenodd" d="M3.707 2.293a1 1 0 00-1.414 1.414l14 14a1 1 0 001.414-1.414l-1.473-1.473A10.014 10.014 0 0019.542 10C18.268 5.943 14.478 3 10 3a9.958 9.958 0 00-4.512 1.074l-1.78-1.781zm4.261 4.26l1.514 1.515a2.003 2.003 0 012.45 2.45l1.514 1.514a4 4 0 00-5.478-5.478z" clipRule="evenodd" /><path d="M12.454 16.697L9.727 13.97a2.003 2.003 0 01-2.45-2.45L4.546 8.777A4 4 0 0012.454 16.697zM10 17a7 7 0 01-7-7c0-1.953.768-3.738 2.002-5.002L14.998 14.998A6.987 6.987 0 0110 17z" /></svg>
                             )}
                        </button>
                    </div>
                     <div>
                        <span className="text-sm font-medium text-slate-700 dark:text-slate-300">Login as</span>
                        <div className="mt-2 grid grid-cols-3 gap-2">
                            {Object.values(Role).map((r) => (
                                <label key={r} className={`flex items-center justify-center space-x-2 p-2 border rounded-lg cursor-pointer transition-all ${role === r ? 'bg-brand-light dark:bg-brand-secondary border-brand-accent shadow-sm' : 'border-slate-300 dark:border-slate-600 hover:bg-slate-50 dark:hover:bg-slate-700'}`}>
                                    <input type="radio" name="role" value={r} checked={role === r} onChange={() => setRole(r)} className="form-radio h-4 w-4 text-brand-accent transition duration-150 ease-in-out hidden" />
                                    <span className={`text-sm ${role === r ? 'text-brand-primary dark:text-white font-semibold' : 'text-slate-700 dark:text-slate-300'}`}>{r}</span>
                                </label>
                            ))}
                        </div>
                    </div>
                    <div className="flex items-center justify-between">
                        <button type="button" onClick={() => navigate('/forgot-password')} className="text-sm text-brand-accent hover:underline">Forgot Password?</button>
                        <button type="button" onClick={() => navigate('/patient/register')} className="text-sm text-brand-accent hover:underline">New User? Create Account</button>
                    </div>
                    <button type="submit" className="w-full py-2.5 px-4 border border-transparent rounded-lg shadow-sm text-sm font-medium text-white bg-brand-primary hover:bg-brand-secondary focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-brand-accent transition-transform transform hover:scale-105">
                        Login
                    </button>
                </form>
                <div className="text-center mt-4 border-t border-slate-200 dark:border-slate-700 pt-4">
                     <button type="button" onClick={() => navigate('/hospital/register')} className="text-sm text-brand-secondary dark:text-brand-accent hover:underline">Are you a hospital? Register here.</button>
                </div>
            </div>
        </div>
    );
};

export default LoginPage;