import { NextRequest, NextResponse } from 'next/server';

export async function GET(req: NextRequest) {
  // Plaid redirects back here for OAuth institutions before Link continues.
  // We don't need to do work; the front-end Link flow resumes automatically.
  return NextResponse.redirect(new URL('/onboard/connect', req.url));
}


