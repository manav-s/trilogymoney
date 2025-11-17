import { NextRequest, NextResponse } from "next/server";
import { createLinkToken } from "@/lib/plaid";

export async function POST(req: NextRequest) {
  try {
    const { phone } = await req.json();
    if (!phone) return NextResponse.json({ error: "phone required" }, { status: 400 });
    const token = await createLinkToken({ clientUserId: phone, clientName: "Trilogy" });
    return NextResponse.json({ link_token: token });
  } catch (e) {
    console.error('add-link-token.error', {
      message: e instanceof Error ? e.message : e,
      response: (e as any)?.response?.data ?? null,
    });
    return NextResponse.json({ error: "failed to create link token" }, { status: 400 });
  }
}


