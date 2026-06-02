'use client';

import { ReactNode, useEffect, useState } from 'react';
import '@/lib/i18n';
import { useTranslation } from 'react-i18next';

export default function I18nProvider({ children }: { children: ReactNode }) {
    const { i18n } = useTranslation();
    const [mounted, setMounted] = useState(false);

    useEffect(() => {
        setMounted(true);
    }, []);

    // Prevent hydration mismatch by only rendering after mount
    // OR we can just render everything and hope for the best if we don't change text based on i18n initially
    if (!mounted) return <div style={{ visibility: 'hidden' }}>{children}</div>;

    return <>{children}</>;
}
