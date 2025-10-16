import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { z } from "zod";
import { onboardingQuiz } from "@/lib/quiz";

const bodySchema = z.object({
  phone: z.string().min(10),
});

export async function POST(req: NextRequest) {
  try {
    const json = await req.json();
    const { phone } = bodySchema.parse(json);

    const user = await prisma.user.findUnique({ where: { phone } });
    if (!user) {
      return NextResponse.json({ error: "User not found" }, { status: 404 });
    }

    const requiredIds = onboardingQuiz.questions.filter(q => q.required !== false).map(q => q.id);
    const answers = await prisma.quizResponse.findMany({ where: { userId: user.id, questionId: { in: requiredIds } } });
    const haveIds = new Set(answers.map(a => a.questionId));
    const missing = requiredIds.filter(id => !haveIds.has(id));
    if (missing.length > 0) {
      return NextResponse.json({ error: "Missing required answers", missing }, { status: 400 });
    }

    await prisma.user.update({ where: { id: user.id }, data: { onboardingStatus: "quiz_complete" } });
    return NextResponse.json({ success: true });
  } catch (e) {
    return NextResponse.json({ error: "Failed to complete quiz" }, { status: 500 });
  }
}


