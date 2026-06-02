'use client';

import { useTranslation } from 'react-i18next';
import { useState, useRef, useEffect } from 'react';
import { Languages, ChevronDown, Check } from 'lucide-react';

const languages = [
    { code: 'en', name: 'English', flag: '🇺🇸' },
    { code: 'id', name: 'Indonesia', flag: '🇮🇩' },
    { code: 'zh', name: '中文', flag: '🇨🇳' },
];

export default function LanguageSwitcher() {
    const { i18n } = useTranslation();
    const [isOpen, setIsOpen] = useState(false);
    const dropdownRef = useRef<HTMLDivElement>(null);

    const currentLanguage = languages.find(l => l.code === (i18n.language?.split('-')[0] || 'en')) || languages[0];

    useEffect(() => {
        function handleClickOutside(event: MouseEvent) {
            if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
                setIsOpen(false);
            }
        }
        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, []);

    const changeLanguage = (code: string) => {
        i18n.changeLanguage(code);
        setIsOpen(false);
    };

    return (
        <div ref={dropdownRef} style={{ position: 'relative', width: '100%' }}>
            <button
                onClick={() => setIsOpen(!isOpen)}
                style={{
                    width: '100%',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '10px',
                    padding: '12px 16px',
                    borderRadius: '14px',
                    background: 'var(--card)',
                    border: '1px solid var(--border)',
                    color: 'var(--foreground)',
                    cursor: 'pointer',
                    fontSize: '14px',
                    fontWeight: 600,
                    transition: 'all 0.2s cubic-bezier(0.4, 0, 0.2, 1)',
                    boxShadow: '0 2px 8px rgba(0,0,0,0.05)',
                }}
                onMouseEnter={(e) => e.currentTarget.style.borderColor = 'var(--accent)'}
                onMouseLeave={(e) => e.currentTarget.style.borderColor = 'var(--border)'}
            >
                <Languages size={18} style={{ opacity: 0.6 }} />
                <span style={{ flex: 1, textAlign: 'left' }}>{currentLanguage.flag} {currentLanguage.name}</span>
                <ChevronDown size={14} style={{ transform: isOpen ? 'rotate(180deg)' : 'none', transition: 'transform 0.2s', opacity: 0.5 }} />
            </button>

            {isOpen && (
                <div style={{
                    position: 'absolute',
                    bottom: 'calc(100% + 8px)',
                    left: 0,
                    width: '100%',
                    background: 'var(--card)',
                    border: '1px solid var(--border)',
                    borderRadius: '14px',
                    boxShadow: '0 10px 30px rgba(0,0,0,0.15)',
                    zIndex: 1001,
                    overflow: 'hidden',
                    animation: 'slideUp 0.2s cubic-bezier(0, 0, 0.2, 1)'
                }}>
                    <div style={{ padding: '4px' }}>
                        {languages.map((lang) => (
                            <button
                                key={lang.code}
                                onClick={() => changeLanguage(lang.code)}
                                style={{
                                    width: '100%',
                                    display: 'flex',
                                    alignItems: 'center',
                                    gap: '10px',
                                    padding: '10px 12px',
                                    background: currentLanguage.code === lang.code ? 'var(--background)' : 'transparent',
                                    border: 'none',
                                    borderRadius: '10px',
                                    color: currentLanguage.code === lang.code ? 'var(--primary)' : 'var(--foreground)',
                                    cursor: 'pointer',
                                    fontSize: '13.5px',
                                    fontWeight: currentLanguage.code === lang.code ? 700 : 500,
                                    textAlign: 'left',
                                    transition: 'all 0.15s ease',
                                    marginBottom: '2px'
                                }}
                                onMouseEnter={(e) => {
                                    if (currentLanguage.code !== lang.code) {
                                        e.currentTarget.style.background = 'var(--background)';
                                    }
                                }}
                                onMouseLeave={(e) => {
                                    if (currentLanguage.code !== lang.code) {
                                        e.currentTarget.style.background = 'transparent';
                                    }
                                }}
                            >
                                <span style={{ fontSize: '18px' }}>{lang.flag}</span>
                                <span style={{ flex: 1 }}>{lang.name}</span>
                                {currentLanguage.code === lang.code && <Check size={14} color="var(--success)" />}
                            </button>
                        ))}
                    </div>
                </div>
            )}

            <style jsx>{`
                @keyframes slideUp {
                    from { opacity: 0; transform: translateY(10px) scale(0.95); }
                    to { opacity: 1; transform: translateY(0) scale(1); }
                }
            `}</style>
        </div>
    );
}
