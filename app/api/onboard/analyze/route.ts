import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { z } from "zod";

const schema = z.object({ phone: z.string().min(10) });

function computeSummary(user: { timezone: string; preferredTime: string; quizAnswers: any }) {
  const a = user.quizAnswers || {};
  // baseline score from balances anxiety and overspending
  let score = 50;
  if (a.q5 === 'never') score += 10; else if (a.q5 === 'often') score -= 10;
  if (a.q10 === 'never') score += 10; else if (a.q10 === 'often') score -= 10;
  // debt penalties
  const hasDebt = Array.isArray(a.q7) && a.q7.some((t: string) => t !== 'none');
  if (hasDebt) score -= 10;
  // cushion boost
  if (a.q8 === 'gt_6m') score += 10; else if (a.q8 === 'none') score -= 10;
  score = Math.max(0, Math.min(100, score));

  const bullets: string[] = [];
  if (Array.isArray(a.q6) && a.q6.includes('food_delivery')) bullets.push('trim food delivery to a weekly cap you choose');
  if (hasDebt) bullets.push('automate minimum debt payments this week to avoid fees');
  if (a.q8 === 'none' || a.q8 === 'lt_1m') bullets.push('start building a 1‑month cushion with a small transfer');
  if (bullets.length < 3) bullets.push('weekly check‑in keeps you consistent and accountable');

  return {
    version: 1,
    computedAt: new Date().toISOString(),
    score,
    riskBand: score >= 70 ? 'low' : score >= 40 ? 'medium' : 'high',
    headline: score >= 70 ? 'steady momentum with a weekly nudge' : score >= 40 ? 'clear wins with a bit of structure' : 'let’s stabilize and build steady habits',
    bullets: bullets.slice(0, 3),
    cadence: 'weekly',
    time: user.preferredTime || '09:00',
    tz: user.timezone,
    primaryGoal: a.q3 || null,
    horizonMonths: a.q4 === '3m' ? 3 : a.q4 === '6m' ? 6 : a.q4 === '12m' ? 12 : a.q4 === '24m' ? 24 : null,
    flags: [
      ...(hasDebt ? ['hasDebt'] : []),
      ...(Array.isArray(a.q6) && a.q6.length ? ['hasGuiltyPleasures'] : []),
      ...(a.q8 === 'none' || a.q8 === 'lt_1m' ? ['lowCushion'] : []),
    ],
  } as const;
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { phone } = schema.parse(body);

    const user = await prisma.user.findUnique({ where: { phone } });
    if (!user) return NextResponse.json({ error: 'user not found' }, { status: 404 });

    const summary = computeSummary(user as any);

    await prisma.user.update({
      where: { phone },
      data: { analysisSummary: summary as unknown as object, onboardingStatus: 'analysis_complete' },
    });

    return NextResponse.json({ ok: true, summary, next: '/onboard/plan' });
  } catch (error) {
    return NextResponse.json({ error: 'invalid request' }, { status: 400 });
  }
}


