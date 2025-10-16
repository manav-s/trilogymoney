// Shared constants used across server and client
export const ONBOARDING_PHONE_KEY = 'onboarding_phone';

// Rate limiting
export const RATE_LIMIT_WINDOW_MS = 60 * 1000; // 1 minute
export const MAX_MESSAGES_PER_WINDOW = 3;


// Billing
export const STRIPE_PRICE_ID = process.env.NEXT_PUBLIC_STRIPE_PRICE_ID || "";


