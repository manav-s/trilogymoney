import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { z } from "zod";

const multiNoneExclusive = (values: readonly [string, ...string[]]) =>
  z.union([
    z.tuple([z.literal("none")]),
    z.array(z.enum(values)).min(1),
  ]);

const schema = z.object({
  phone: z.string().min(10),
  version: z.literal(1),
  answers: z.object({
    q1: z.enum(["calm","under_control","manageable","tense","overwhelming"]),
    q2: z.enum(["interest_charges","surprise_bills","overspending","not_saving","not_investing","retiring_early_and_leaving_the_rat_race","nothing"]),
    q3: z.enum(["pay_down_card","build_1mo_cushion","stop_leak_spend","automate_bills","start_investing"]),
    q4: z.enum(["payday_slips","weekend_spend","late_night_scroll","unexpected_bill","social_plans"]),
    q5: z.enum(["often","sometimes","rarely","never"]),
    q6: multiNoneExclusive(["food_delivery","prime","coffee"]),
    q7: multiNoneExclusive(["credit_card","student","auto","other"]),
    q8: z.enum(["none","lt_1m","m_1_3","m_3_6","gt_6m"]),
    q9: z.enum(["none","notes","spreadsheet","app","bank_only"]),
    q10: z.enum(["never","rarely","sometimes","often"]),
  }),
});

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { phone, answers } = schema.parse(body);

    const user = await prisma.user.findUnique({ where: { phone } });
    if (!user) {
      return NextResponse.json({ error: "user not found" }, { status: 404 });
    }

    await prisma.user.update({
      where: { phone },
      data: {
        quizAnswers: answers as unknown as object,
        onboardingStatus: "quiz_complete",
      },
    });

    return NextResponse.json({ ok: true, next: "/onboard/analyzing" });
  } catch (error) {
    return NextResponse.json({ error: "invalid request" }, { status: 400 });
  }
}


