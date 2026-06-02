'use client';

import { useEffect } from 'react';

/**
 * Client-side Log Suppressor
 * This component runs in the browser and silences the console.
 */
export default function LogSuppressor() {
    useEffect(() => {
        // Only silence in production by default, or force it if you want
        const shouldSilence = process.env.NODE_ENV === 'production' || true;

        if (shouldSilence) {
            const noop = () => { };
            // console.log = noop;
            console.info = noop;
            console.debug = noop;
            console.warn = noop;
        }
    }, []);

    return null;
}
