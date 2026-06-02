'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { CircularProgress } from '@mui/material';

export default function CreatorRedirectPage() {
    const router = useRouter();

    useEffect(() => {
        const lastUsername = localStorage.getItem('last_creator_username');
        const lastToken = localStorage.getItem('last_creator_token');

        if (lastUsername && lastToken) {
            router.replace(`/creator/s/${lastUsername}/${lastToken}`);
        } else {
            router.replace('/'); // Redirect to home if no memory found
        }
    }, [router]);

    return (
        <div style={{
            height: '100vh',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            background: '#fafafa',
            gap: '16px'
        }}>
            <img src="/logo.png" alt="Crowncare" style={{ width: '80px', height: '80px', marginBottom: '20px' }} />
            <CircularProgress color="inherit" size={30} />
            <p style={{ fontSize: '14px', color: '#666', fontWeight: 600 }}>Memuat sesi terakhir Anda...</p>
        </div>
    );
}
