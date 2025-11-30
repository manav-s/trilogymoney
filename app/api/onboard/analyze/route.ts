import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db/db";
import { z } from "zod";

const schema = z.object({ phone: z.string().min(10) });

type QuizAnswers = {
  q1?: string; q2?: string[]; q3?: string; q4?: string; q5?: string;
  q6?: string[]; q7?: string[]; q8?: string; q9?: string; q10?: string;
};

function computeSummary(user: { timezone: string; preferredTime: string; quizAnswers: QuizAnswers | null }) {
  const a: QuizAnswers = user.quizAnswers || {};
  // baseline score from balances anxiety and overspending
  let score = 50;
  if (a.q5 === 'never') score += 11; else if (a.q5 === 'rarely') score += 4; else if (a.q5 === 'sometimes') score -= 3; else if (a.q5 === 'often') score -= 12;
  if (a.q10 === 'never') score += 9; else if (a.q10 === 'rarely') score += 3; else if (a.q10 === 'sometimes') score -= 4; else if (a.q10 === 'often') score -= 11;
  // debt penalties (scaled by count)
  const debtTypes = Array.isArray(a.q7) ? a.q7.filter((t) => t !== 'none') : [];
  score -= debtTypes.length * 6;
  // cushion boost
  if (a.q8 === 'gt_6m') score += 13; else if (a.q8 === 'm_3_6') score += 7; else if (a.q8 === 'm_1_3') score += 2; else if (a.q8 === 'lt_1m') score -= 5; else if (a.q8 === 'none') score -= 11;
  // guilty pleasures (minor penalty)
  const pleasures = Array.isArray(a.q6) ? a.q6.filter((t) => t !== 'none') : [];
  score -= pleasures.length * 2;
  // add slight noise so scores don't end in 0
  score += Math.floor(Math.random() * 5) - 2; // -2 to +2
  score = Math.max(0, Math.min(100, score));

  const hasDebt = debtTypes.length > 0;
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

  const summary = computeSummary({
    timezone: user.timezone,
    preferredTime: user.preferredTime,
    quizAnswers: (user as unknown as { quizAnswers?: QuizAnswers }).quizAnswers ?? null,
  });

    await prisma.user.update({
      where: { phone },
      data: {
        onboardingStatus: 'analysis_complete',
        ...( { analysisSummary: summary } as Record<string, unknown> ),
      },
    });

    return NextResponse.json({ ok: true, summary, next: '/onboard/plan' });
  } catch (error) {
    return NextResponse.json({ error: 'invalid request' }, { status: 400 });
  }
}


