# Environment Variables Setup

Create a `.env` file in the root directory with the following variables:

```bash
# Database
DATABASE_URL="postgresql://username:password@localhost:5432/threumbers?schema=public"

# Authentication  
NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY=""
CLERK_SECRET_KEY=""

# Payments
STRIPE_SECRET_KEY=""
STRIPE_WEBHOOK_SECRET=""
NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY=""

# SMS
TWILIO_ACCOUNT_SID=""
TWILIO_AUTH_TOKEN=""
TWILIO_PHONE_NUMBER=""

# Banking
PLAID_CLIENT_ID=""
PLAID_SECRET=""
PLAID_ENV="sandbox"

# App
NEXT_PUBLIC_URL="http://localhost:3000"
ENCRYPTION_KEY=""
```

## Setup Instructions

1. Copy the above variables into a `.env` file
2. Fill in the actual values for each service
3. Ensure `.env` is added to your `.gitignore` file
