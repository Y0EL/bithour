import MOUForm from '@/components/MOUForm';
import Link from 'next/link';
import { ArrowLeft } from 'lucide-react';

export default function CreateMOUPage() {
    return (
        <main className="container animate-in">
            <div style={{ marginBottom: '40px' }}>
                <Link href="/" style={{ display: 'inline-flex', alignItems: 'center', gap: '8px', color: 'var(--muted)', fontWeight: 500 }}>
                    <ArrowLeft size={18} /> Back to Dashboard
                </Link>
                <h1 style={{ marginTop: '20px', fontSize: '32px', fontWeight: 800 }}>Create New MOU</h1>
                <p style={{ color: 'var(--muted)', marginTop: '8px' }}>
                    Generate Memorandum of Understanding document for content creators.
                </p>
            </div>

            <MOUForm />
        </main>
    );
}
