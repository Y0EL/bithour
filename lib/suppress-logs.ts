/**
 * Crowncare Log Suppressor
 * This utility silences all // console.logs (except errors) to maintain a clean terminal and browser console.
 * It is enabled by default in production, but can be forced in development if needed.
 */

const SILENCE_ALL = true; // Set to true to silence even in development

if (typeof window !== 'undefined' || typeof global !== 'undefined') {
    const isProduction = process.env.NODE_ENV === 'production';

    if (isProduction || SILENCE_ALL) {
        const noop = () => { };

        // Suppress standard logs
        // console.log = noop;
        console.info = noop;
        console.debug = noop;
        console.warn = noop;

        // We keep console.error for critical debugging
        // console.error = noop; 

        if (typeof window !== 'undefined') {
            (window as any)._logsSilenced = true;
        }
    }
}
