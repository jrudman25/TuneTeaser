/**
 * analytics.ts
 * Umami analytics. Injects the tracking script in production builds only so
 * dev and emulator sessions don't pollute stats, and exposes trackEvent for
 * custom events. All calls are no-ops when the script is absent or blocked.
 * @version 2026.11.08
 */

const UMAMI_WEBSITE_ID = '43514b54-3870-44aa-bb00-e50b6cc50ee3';
const UMAMI_SCRIPT_URL = 'https://cloud.umami.is/script.js';

declare global {
    interface Window {
        umami?: { track: (eventName: string, eventData?: Record<string, unknown>) => void };
    }
}

export const initAnalytics = () => {
    if (!import.meta.env.PROD) return;
    const script = document.createElement('script');
    script.defer = true;
    script.src = UMAMI_SCRIPT_URL;
    script.dataset.websiteId = UMAMI_WEBSITE_ID;
    document.head.appendChild(script);
};

export const trackEvent = (eventName: string, eventData?: Record<string, unknown>) => {
    window.umami?.track(eventName, eventData);
};
