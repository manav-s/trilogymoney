# Environment Variables Setup for Clerk Authentication

## Quick Setup Instructions

1. **Create a `.env.local` file** in the project root
2. **Copy the variables below** and fill in your Clerk keys
3. **Get Clerk API keys** from https://clerk.com/

## Required Environment Variables

```bash
# Clerk Authentication (REQUIRED for auth to work)
NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY=pk_test_your_publishable_key_here
CLERK_SECRET_KEY=sk_test_your_secret_key_here

# Clerk URLs (optional - defaults work for development)
NEXT_PUBLIC_CLERK_SIGN_IN_URL=/signin
NEXT_PUBLIC_CLERK_SIGN_UP_URL=/signup
NEXT_PUBLIC_CLERK_AFTER_SIGN_IN_URL=/dashboard
NEXT_PUBLIC_CLERK_AFTER_SIGN_UP_URL=/dashboard

# Database (for later)
DATABASE_URL="postgresql://username:password@localhost:5432/threumbers?schema=public"

# Payments (for later)
STRIPE_SECRET_KEY=""
STRIPE_WEBHOOK_SECRET=""
NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY=""

# SMS (for later)
TWILIO_ACCOUNT_SID=""
TWILIO_AUTH_TOKEN=""
TWILIO_PHONE_NUMBER=""

# Banking (for later)
PLAID_CLIENT_ID=""
PLAID_SECRET=""
PLAID_ENV="sandbox"

# App
NEXT_PUBLIC_URL="http://localhost:3001"
ENCRYPTION_KEY=""
```

## How to Get Clerk API Keys

1. Go to https://clerk.com/
2. Sign up for a free account
3. Create a new application called "3Numbers"
4. Go to **API Keys** in the sidebar
5. Copy the **Publishable Key** and **Secret Key**
6. Paste them into your `.env.local` file

## Test Authentication

Once you have the keys set up:
1. Restart your development server (`npm run dev`)
2. Visit http://localhost:3001
3. Click "Get Started" or "Sign In" 
4. You should see Clerk's authentication modal

The authentication is now ready to use!
