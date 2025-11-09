import React, { useState, useRef, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';

const HospitalOtpPage: React.FC = () => {
    const [otp, setOtp] = useState<string[]>(new Array(6).fill(""));
    const [timer, setTimer] = useState(25);
    const navigate = useNavigate();
    const inputsRef = useRef<(HTMLInputElement | null)[]>([]);

    useEffect(() => {
        const interval = setInterval(() => {
            setTimer((prev) => (prev > 0 ? prev - 1 : 0));
        }, 1000);
        return () => clearInterval(interval);
    }, []);

    const handleChange = (element: HTMLInputElement, index: number) => {
        if (isNaN(Number(element.value))) return;

        setOtp([...otp.map((d, idx) => (idx === index ? element.value : d))]);

        if (element.nextSibling && element.value) {
            (element.nextSibling as HTMLInputElement).focus();
        }
    };

    const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>, index: number) => {
        if (e.key === "Backspace" && !otp[index] && index > 0) {
            inputsRef.current[index - 1]?.focus();
        }
    };
    
    const handleVerify = () => {
        // Mock verification logic
        alert(`Verifying OTP: ${otp.join("")}. Redirecting to login.`);
        navigate('/login'); // Redirect to login, they can login once approved by admin
    };

    return (
        <div className="min-h-screen flex items-center justify-center p-4 relative overflow-hidden">
            <div className="absolute top-0 left-0 -translate-x-1/4 -translate-y-1/4 w-96 h-96 bg-brand-accent/20 dark:bg-brand-accent/30 rounded-full blur-3xl"></div>
            <div className="absolute bottom-0 right-0 translate-x-1/4 translate-y-1/4 w-96 h-96 bg-brand-primary/20 dark:bg-brand-primary/30 rounded-full blur-3xl delay-500"></div>
            <div className="w-full max-w-md p-8 space-y-6 bg-white/80 dark:bg-slate-800/80 backdrop-blur-lg rounded-2xl shadow-xl border border-slate-200 dark:border-slate-700 z-10 text-center">
                 <h2 className="text-2xl font-bold text-slate-800 dark:text-white">Verify Hospital Email</h2>
                <p className="text-slate-600 dark:text-slate-400">
                    We sent a verification code to <br /> <span className="font-semibold">rajesh@apollo.com</span>
                </p>
                 <p className="text-sm text-slate-500 dark:text-slate-400">Code expires in: 09:{timer < 10 ? `0${timer}` : timer}</p>
                <div className="flex justify-center space-x-2">
                    {otp.map((data, index) => (
                        <input
                            key={index}
                            type="text"
                            name="otp"
                            maxLength={1}
                            className="w-12 h-12 text-center text-2xl border border-slate-300 dark:border-slate-600 rounded-lg shadow-sm focus:ring-brand-accent focus:border-brand-accent bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100"
                            value={data}
                            onChange={e => handleChange(e.target, index)}
                            onKeyDown={e => handleKeyDown(e, index)}
                            onFocus={e => e.target.select()}
                            ref={el => { inputsRef.current[index] = el }}
                            aria-label={`OTP digit ${index + 1}`}
                        />
                    ))}
                </div>
                <p className="text-slate-500 dark:text-slate-400">Didn't receive code?</p>
                <button 
                  className="text-brand-accent hover:underline disabled:text-slate-400 disabled:no-underline"
                  disabled={timer > 0}
                  onClick={() => setTimer(25)}
                >
                    Resend OTP {timer > 0 ? `(Cooldown: ${timer}s)` : ''}
                </button>
                <div className="flex flex-col space-y-4 pt-4">
                     <button onClick={handleVerify} className="w-full py-2.5 px-4 border border-transparent rounded-lg shadow-sm text-sm font-medium text-white bg-brand-primary hover:bg-brand-secondary transition-transform transform hover:scale-105">
                        Verify Email
                    </button>
                    <p className="text-xs text-slate-500 dark:text-slate-400">Need help? Contact support@g1card.com</p>
                </div>
            </div>
        </div>
    );
};

export default HospitalOtpPage;