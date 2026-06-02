import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';
import LanguageDetector from 'i18next-browser-languagedetector';

import enTranslation from '../../locales/en/translation.json';
import idTranslation from '../../locales/id/translation.json';
import zhTranslation from '../../locales/zh/translation.json';

const resources = {
    en: { translation: enTranslation },
    id: { translation: idTranslation },
    zh: { translation: zhTranslation },
};

i18n
    .use(LanguageDetector)
    .use(initReactI18next)
    .init({
        resources,
        fallbackLng: 'en',
        interpolation: {
            escapeValue: false,
        },
        detection: {
            order: ['localStorage', 'cookie', 'htmlTag', 'path', 'subdomain'],
            caches: ['localStorage', 'cookie'],
        }
    });

export default i18n;
