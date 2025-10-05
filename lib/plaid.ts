import { Configuration, PlaidApi, PlaidEnvironments } from 'plaid';

// Plaid client configuration
const configuration = new Configuration({
  basePath: PlaidEnvironments[process.env.PLAID_ENV as keyof typeof PlaidEnvironments] || PlaidEnvironments.sandbox,
  baseOptions: {
    headers: {
      'PLAID-CLIENT-ID': process.env.PLAID_CLIENT_ID,
      'PLAID-SECRET': process.env.PLAID_SECRET,
      'Plaid-Version': '2020-09-14',
    },
  },
});

export const plaidClient = new PlaidApi(configuration);

// Plaid configuration for frontend
export const plaidConfig = {
  clientId: process.env.PLAID_CLIENT_ID,
  env: process.env.PLAID_ENV || 'sandbox',
  publicKey: process.env.PLAID_PUBLIC_KEY, // For older Plaid versions if needed
};

// Common Plaid products for 3Numbers
// Valid products: 'transactions', 'auth', 'identity', 'assets', 'investments', 'liabilities'
export const PLAID_PRODUCTS = ['transactions', 'auth', 'identity'] as const;
export const PLAID_COUNTRY_CODES = ['US'] as const;
