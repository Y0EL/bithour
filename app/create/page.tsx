import InvoiceForm from '@/components/InvoiceForm';
import Link from 'next/link';
import { ArrowLeft } from 'lucide-react';

export default function CreateInvoicePage() {
    return (
        <main className="container animate-in">
            <div style={{ marginBottom: '40px' }}>
                <Link href="/" style={{ display: 'inline-flex', alignItems: 'center', gap: '8px', color: 'var(--muted)', fontWeight: 500 }}>
                    <ArrowLeft size={18} /> Back to Dashboard
                </Link>
                <h1 style={{ marginTop: '20px', fontSize: '32px', fontWeight: 800 }}>Create New Invoice</h1>
                <p style={{ color: 'var(--muted)', marginTop: '8px' }}>Fill in the details below to generate a pixel-perfect A4 invoice.</p>
            </div>

            <InvoiceForm />
        </main>
    );
}
