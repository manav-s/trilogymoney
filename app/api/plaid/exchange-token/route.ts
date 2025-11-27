import { NextRequest, NextResponse } from 'next/server';
import { getPlaidClient, getPlaidDefaults } from '@/lib/integrations/plaid';
import { prisma } from '@/lib/db/db';
import { z } from 'zod';
import { encryptMessage } from '@/lib/db/encryption';
import { logError } from '@/lib/utils/logger';

const schema = z.object({ phone: z.string().min(10), public_token: z.string().min(10) });

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { phone, public_token } = schema.parse(body);
    const user = await prisma.user.findUnique({ where: { phone } });
    if (!user) return NextResponse.json({ error: 'user not found' }, { status: 404 });

    const client = getPlaidClient();
    const exchange = await client.itemPublicTokenExchange({ public_token });
    const accessToken = exchange.data.access_token;
    const itemId = exchange.data.item_id;

    // Get institution name via Plaid (requires institution lookup)
    let institutionName: string | null = null;
    try {
      const itemResp = await client.itemGet({ access_token: accessToken });
      const instId = itemResp.data.item?.institution_id || null;
      if (instId) {
        try {
          const { countryCodes } = getPlaidDefaults();
          const instResp = await client.institutionsGetById({ institution_id: instId, country_codes: countryCodes });
          institutionName = instResp.data.institution?.name || null;
          if (!institutionName) {
            logError('plaid.exchange.institution_name_null', undefined, {
              hasItem: !!itemResp.data.item,
              institutionId: instId,
              hasInstitution: !!instResp.data.institution,
            });
          }
        } catch (inner) {
          logError('plaid.exchange.institution_lookup_failed', inner, { institutionId: instId });
        }
      } else {
        logError('plaid.exchange.institution_id_missing', undefined, {
          hasItem: !!itemResp.data.item,
        });
      }
    } catch (e) {
      logError('plaid.exchange.item_get_failed', e, {
        hasAccessToken: !!accessToken,
      });
    }

    // create PlaidItem
    const item = await prisma.plaidItem.create({
      data: {
        userId: user.id,
        itemId,
        accessToken: encryptMessage(accessToken),
        institutionName,
      },
    });

    // fetch accounts
    const accountsResp = await client.accountsGet({ access_token: accessToken });
    const accounts = accountsResp.data.accounts || [];
    for (const a of accounts) {
      await prisma.plaidAccount.upsert({
        where: { accountId: a.account_id },
        update: {
          name: a.name || a.official_name || 'Account',
          officialName: a.official_name || null,
          mask: a.mask || null,
          type: a.type || 'unknown',
          subtype: a.subtype || null,
          currency: a.balances?.iso_currency_code || null,
          currentBalance: a.balances?.current ?? null,
          availableBalance: a.balances?.available ?? null,
          itemId: item.id,
        },
        create: {
          accountId: a.account_id,
          itemId: item.id,
          name: a.name || a.official_name || 'Account',
          officialName: a.official_name || null,
          mask: a.mask || null,
          type: a.type || 'unknown',
          subtype: a.subtype || null,
          currency: a.balances?.iso_currency_code || null,
          currentBalance: a.balances?.current ?? null,
          availableBalance: a.balances?.available ?? null,
        },
      });
    }

    // mark onboarding status only if the user isn't already complete/subscribed
    if (user.onboardingStatus !== 'complete' && user.onboardingStatus !== 'subscribed') {
      await prisma.user.update({ where: { id: user.id }, data: { onboardingStatus: 'plaid_connected' } });
    }

    return NextResponse.json({ ok: true, itemId: item.id, accounts: accounts.map((a) => a.account_id) });
  } catch (e) {
    return NextResponse.json({ error: 'exchange failed' }, { status: 400 });
  }
}



