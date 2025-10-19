import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";

function nextPath(status: string | null | undefined): string {
  switch (status) {
    case "pre_auth":
      return "/onboard/step-a";
    case "step_a_complete":
      return "/onboard/quiz";
    case "profile_collected":
      return "/onboard/quiz";
    case "quiz_complete":
      return "/onboard/analyzing";
    case "analysis_complete":
      return "/onboard/plan";
    case "plaid_connected":
      return "/onboard/checkout";
    case "subscribed":
    case "complete":
      return "/dashboard";
    default:
      return "/";
  }
}

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const phone = searchParams.get("phone");
  if (!phone) {
    return NextResponse.json({ error: "phone required" }, { status: 400 });
  }
  const user = await prisma.user.findUnique({ where: { phone } });
  const status = user?.onboardingStatus || "pre_auth";
  return NextResponse.json({ status, next: nextPath(status) });
}
