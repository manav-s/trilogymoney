import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { z } from "zod";

const schema = z.object({
  phone: z.string().min(10),
  version: z.literal(1),
  answers: z.object({
    q1: z.string(), q2: z.string(), q3: z.string(), q4: z.string(), q5: z.string(),
    q6: z.string(), q7: z.string(), q8: z.string(), q9: z.string(), q10: z.string(), q11: z.string(),
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


