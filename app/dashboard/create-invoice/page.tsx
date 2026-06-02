'use client';

import React, { Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
import InvoiceForm from '@/components/InvoiceForm';
import { useSession } from 'next-auth/react';
import { AlertCircle } from 'lucide-react';

function CreateInvoiceContent() {
    const { data: session } = useSession();
    const searchParams = useSearchParams();
    const sessionId = searchParams.get('sessionId') || undefined;
    const mouId = searchParams.get('mouId') || undefined;

    const user = session?.user as any;

    if (user?.role === 'ANALYST') {
        return (
            <div style={{ textAlign: 'center', padding: '100px 20px', background: '#fff', borderRadius: '32px', border: '1px solid #f1f5f9', marginTop: '40px' }}>
                <div style={{ width: '80px', height: '80px', background: '#fef2f2', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 24px' }}>
                    <AlertCircle size={40} color="#ef4444" />
                </div>
                <h2 style={{ fontSize: '24px', fontWeight: 800, color: '#1a1a1a', marginBottom: '12px' }}>Akses Terbatas</h2>
                <p style={{ color: '#64748b', fontSize: '16px', maxWidth: '400px', margin: '0 auto 32px' }}>
                    Role <b>Analyst</b> tidak diperbolehkan untuk membuat Invoice.
                </p>
            </div>
        );
    }

    return (
        <div>
            {/* Header handled by the form component */}
            <InvoiceForm sessionId={sessionId} mouId={mouId} />
        </div>
    );
}

export default function CreateInvoicePage() {
    return (
        <Suspense fallback={<div>Loading...</div>}>
            <CreateInvoiceContent />
        </Suspense>
    );
}
