
import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';

const ForgotPasswordPage: React.FC = () => {
    const [email, setEmail] = useState('');
    const [message, setMessage] = useState('');
    const navigate = useNavigate();

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        // Mock API call
        setMessage(`If an account exists for ${email}, a reset link has been sent.`);
    };

    return (
        <div className="min-h-screen flex items-center justify-center p-4 relative overflow-hidden">
             <div className="absolute top-0 left-0 -translate-x-1/4 -translate-y-1/4 w-96 h-96 bg-brand-accent/20 dark:bg-brand-accent/30 rounded-full blur-3xl"></div>
            <div className="absolute bottom-0 right-0 translate-x-1/4 translate-y-1/4 w-96 h-96 bg-brand-primary/20 dark:bg-brand-primary/30 rounded-full blur-3xl delay-500"></div>
            <div className="w-full max-w-md p-8 space-y-6 bg-white/80 dark:bg-slate-800/80 backdrop-blur-lg rounded-2xl shadow-xl border border-slate-200 dark:border-slate-700 z-10">
                <div className="text-center">
                    <h2 className="text-2xl font-bold text-slate-800 dark:text-white">Reset Your Password</h2>
                    <p className="text-slate-600 dark:text-slate-400">Enter your registered email to receive a reset link.</p>
                </div>
                <form onSubmit={handleSubmit} className="space-y-4">
                    <input
                        type="email"
                        value={email}
                        onChange={(e) => setEmail(e.target.value)}
                        placeholder="Email Address"
                        className="w-full px-3 py-2 border border-slate-300 dark:border-slate-600 rounded-lg focus:ring-brand-accent focus:border-brand-accent bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100 placeholder:text-slate-400 dark:placeholder:text-slate-500"
                        required
                    />
                     {message && <p className="text-sm text-green-700 dark:text-green-300 bg-green-100 dark:bg-green-900/50 p-3 rounded-lg">{message}</p>}
                    <button type="submit" className="w-full py-2.5 px-4 border border-transparent rounded-lg shadow-sm text-sm font-medium text-white bg-brand-primary hover:bg-brand-secondary transition-transform transform hover:scale-105">
                        Send Reset Link
                    </button>
                    <button type="button" onClick={() => navigate('/login')} className="w-full py-2 px-4 border border-slate-300 dark:border-slate-600 rounded-lg shadow-sm text-sm font-medium text-slate-700 dark:text-slate-200 bg-white/50 dark:bg-slate-700/50 hover:bg-slate-50 dark:hover:bg-slate-700">
                        Back to Login
                    </button>
                </form>
            </div>
        </div>
    );
};

export default ForgotPasswordPage;