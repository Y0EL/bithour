import { useState, useCallback } from 'react';

export interface JobStatus {
    id: string;
    state: 'active' | 'completed' | 'failed' | 'waiting' | 'delayed' | 'prioritized';
    progress: number;
    result: unknown;
    failedReason: string | null;
}

export const useJobStatus = () => {
    const [status, setStatus] = useState<JobStatus | null>(null);
    const [error, setError] = useState<string | null>(null);

    const pollJobStatus = useCallback(async (jobId: string, onComplete?: (result: unknown) => void, onError?: (err: string) => void) => {
        setError(null);

        const checkStatus = async () => {
            try {
                const res = await fetch(`/api/jobs/${jobId}`);
                if (!res.ok) throw new Error('Failed to fetch job status');

                const data: JobStatus = await res.json();
                setStatus(data);

                if (data.state === 'completed') {
                    if (onComplete) onComplete(data.result);
                    return true; // Stop polling
                } else if (data.state === 'failed') {
                    const errMsg = data.failedReason || 'Job failed';
                    setError(errMsg);
                    if (onError) onError(errMsg);
                    return true; // Stop polling
                }

                return false; // Keep polling
            } catch (err: unknown) {
                const errMsg = err instanceof Error ? err.message : 'Unknown error';
                setError(errMsg);
                if (onError) onError(errMsg);
                return true; // Stop polling
            }
        };

        // Initial check
        const isDone = await checkStatus();
        if (isDone) return;

        // Start interval
        const interval = setInterval(async () => {
            const isDone = await checkStatus();
            if (isDone) clearInterval(interval);
        }, 2000);

        return () => clearInterval(interval);
    }, []);

    return { status, error, pollJobStatus };
};
