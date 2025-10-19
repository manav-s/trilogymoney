import { Configuration, PlaidApi, PlaidEnvironments, CountryCode, Products, LinkTokenCreateRequest } from 'plaid';

export function getPlaidClient(): PlaidApi {
  const clientId = process.env.PLAID_CLIENT_ID as string;
  const secret = process.env.PLAID_SECRET as string;
  const env = (process.env.PLAID_ENV || 'sandbox') as keyof typeof PlaidEnvironments;

  const config = new Configuration({
    basePath: PlaidEnvironments[env] || PlaidEnvironments.sandbox,
    baseOptions: {
      headers: {
        'PLAID-CLIENT-ID': clientId,
        'PLAID-SECRET': secret,
      },
    },
  });
  return new PlaidApi(config);
}

export function getPlaidDefaults() {
  const countryCodes = (process.env.PLAID_COUNTRY_CODES || 'US')
    .split(',')
    .map((c) => c.trim())
    .filter(Boolean) as CountryCode[];
  const products = (process.env.PLAID_PRODUCTS || 'transactions')
    .split(',')
    .map((p) => p.trim())
    .filter(Boolean) as Products[];
  const redirectUri = process.env.PLAID_REDIRECT_URI;
  return { countryCodes, products, redirectUri };
}

export async function createLinkToken(params: { clientUserId: string; clientName: string; }): Promise<string> {
  const client = getPlaidClient();
  const { countryCodes, products, redirectUri } = getPlaidDefaults();

  const request: LinkTokenCreateRequest = {
    user: { client_user_id: params.clientUserId },
    client_name: params.clientName,
    products,
    country_codes: countryCodes,
    language: 'en',
  };
  if (redirectUri) (request as any).redirect_uri = redirectUri; // tolerated if type lags

  const resp = await client.linkTokenCreate(request as any);
  return resp.data.link_token;
}

