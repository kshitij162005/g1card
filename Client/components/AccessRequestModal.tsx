import React, { useState } from 'react';

interface AccessRequestModalProps {
    isOpen: boolean;
    onClose: () => void;
    hospitalName: string;
    requestId: string;
    onApprove: (accessLevel: 'general' | 'complete', requestId: string) => void;
    onDeny: (requestId: string) => void;
}

const AccessRequestModal: React.FC<AccessRequestModalProps> = ({
    isOpen,
    onClose,
    hospitalName,
    requestId,
    onApprove,
    onDeny
}) => {
    const [selectedLevel, setSelectedLevel] = useState<'general' | 'complete'>('general');
    const [isProcessing, setIsProcessing] = useState(false);

    if (!isOpen) return null;

    const handleApprove = async () => {
        setIsProcessing(true);
        try {
            await onApprove(selectedLevel, requestId);
            onClose();
        } finally {
            setIsProcessing(false);
        }
    };

    const handleDeny = async () => {
        setIsProcessing(true);
        try {
            await onDeny(requestId);
            onClose();
        } finally {
            setIsProcessing(false);
        }
    };

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 animate-in fade-in duration-200">
            {/* Backdrop */}
            <div 
                className="absolute inset-0 bg-black/70 backdrop-blur-sm"
                onClick={onClose}
            />

            {/* Modal Container */}
            <div className="relative w-full max-w-lg animate-in zoom-in-95 duration-200">
                <div className="bg-slate-900 border border-slate-800 rounded-lg shadow-xl overflow-hidden">
                    
                    {/* Header Section */}
                    <div className="border-b border-slate-800 px-6 py-4">
                        <div className="flex items-center justify-between">
                            <div>
                                <h2 className="text-lg font-semibold text-white tracking-tight">Medical Records Access Request</h2>
                                <p className="text-sm text-slate-400 mt-1">{hospitalName}</p>
                            </div>
                            <button
                                onClick={onClose}
                                className="text-slate-500 hover:text-slate-300 transition-colors p-1"
                                aria-label="Close"
                            >
                                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                                </svg>
                            </button>
                        </div>
                    </div>

                    {/* Content Section */}
                    <div className="px-6 py-5">
                        <p className="text-sm text-slate-300 leading-relaxed mb-6">
                            This healthcare facility is requesting permission to view your medical records. 
                            Please select the appropriate level of access below.
                        </p>

                        {/* Access Level Options */}
                        <div className="space-y-3 mb-6">
                            {/* General Access Option */}
                            <div
                                onClick={() => setSelectedLevel('general')}
                                className={`relative cursor-pointer border rounded-lg p-4 transition-all ${
                                    selectedLevel === 'general'
                                        ? 'bg-slate-800/50 border-blue-600'
                                        : 'bg-slate-800/20 border-slate-700 hover:border-slate-600'
                                }`}
                            >
                                <div className="flex items-start gap-4">
                                    <div className="pt-0.5">
                                        <div className={`w-4 h-4 rounded-full border-2 flex items-center justify-center transition-colors ${
                                            selectedLevel === 'general'
                                                ? 'border-blue-600 bg-blue-600'
                                                : 'border-slate-600'
                                        }`}>
                                            {selectedLevel === 'general' && (
                                                <div className="w-1.5 h-1.5 rounded-full bg-white" />
                                            )}
                                        </div>
                                    </div>
                                    <div className="flex-1">
                                        <h3 className="text-sm font-medium text-white mb-1.5">General Information Only</h3>
                                        <p className="text-xs text-slate-400 leading-relaxed">
                                            Basic medical history, known allergies, current medications, and vaccination records.
                                        </p>
                                    </div>
                                </div>
                            </div>

                            {/* Complete Access Option */}
                            <div
                                onClick={() => setSelectedLevel('complete')}
                                className={`relative cursor-pointer border rounded-lg p-4 transition-all ${
                                    selectedLevel === 'complete'
                                        ? 'bg-slate-800/50 border-blue-600'
                                        : 'bg-slate-800/20 border-slate-700 hover:border-slate-600'
                                }`}
                            >
                                <div className="flex items-start gap-4">
                                    <div className="pt-0.5">
                                        <div className={`w-4 h-4 rounded-full border-2 flex items-center justify-center transition-colors ${
                                            selectedLevel === 'complete'
                                                ? 'border-blue-600 bg-blue-600'
                                                : 'border-slate-600'
                                        }`}>
                                            {selectedLevel === 'complete' && (
                                                <div className="w-1.5 h-1.5 rounded-full bg-white" />
                                            )}
                                        </div>
                                    </div>
                                    <div className="flex-1">
                                        <h3 className="text-sm font-medium text-white mb-1.5">Complete Medical Records</h3>
                                        <p className="text-xs text-slate-400 leading-relaxed">
                                            Full access including detailed medical history, laboratory results, diagnostic imaging, 
                                            treatment plans, and all clinical documentation.
                                        </p>
                                    </div>
                                </div>
                            </div>
                        </div>

                        {/* Info Notice */}
                        <div className="bg-slate-800/30 border border-slate-700/50 rounded-md px-4 py-3 mb-6">
                            <div className="flex gap-3">
                                <svg className="w-5 h-5 text-slate-400 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                                </svg>
                                <p className="text-xs text-slate-400 leading-relaxed">
                                    You can modify or revoke access permissions at any time from your settings.
                                </p>
                            </div>
                        </div>
                    </div>

                    {/* Footer Actions */}
                    <div className="border-t border-slate-800 px-6 py-4 bg-slate-900/50">
                        <div className="flex gap-3 justify-end">
                            <button
                                onClick={handleDeny}
                                disabled={isProcessing}
                                className="px-5 py-2.5 text-sm font-medium text-slate-300 bg-transparent border border-slate-700 rounded-md hover:bg-slate-800 hover:border-slate-600 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                            >
                                Deny Access
                            </button>
                            <button
                                onClick={handleApprove}
                                disabled={isProcessing}
                                className="px-5 py-2.5 text-sm font-medium text-white bg-blue-600 rounded-md hover:bg-blue-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed min-w-[120px]"
                            >
                                {isProcessing ? 'Processing...' : 'Grant Access'}
                            </button>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default AccessRequestModal;
