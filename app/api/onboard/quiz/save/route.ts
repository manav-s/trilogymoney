import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { z } from "zod";
import { onboardingQuiz, isValidAnswer, QuizAnswerValue } from "@/lib/quiz";

const bodySchema = z.object({
  phone: z.string().min(10),
  questionId: z.string().min(1),
  value: z.any(),
});

export async function POST(req: NextRequest) {
  try {
    const json = await req.json();
    const { phone, questionId, value } = bodySchema.parse(json);

    const user = await prisma.user.findUnique({ where: { phone } });
    if (!user) {
      return NextResponse.json({ error: "User not found" }, { status: 404 });
    }

    const question = onboardingQuiz.questions.find((q) => q.id === questionId);
    if (!question) {
      return NextResponse.json({ error: "Unknown questionId" }, { status: 400 });
    }

    if (!isValidAnswer(question, value as QuizAnswerValue)) {
      return NextResponse.json({ error: "Invalid answer" }, { status: 400 });
    }

    await prisma.quizResponse.upsert({
      where: { userId_questionId: { userId: user.id, questionId } },
      update: { answer: value },
      create: { userId: user.id, questionId, answer: value },
    });

    if (user.onboardingStatus === "step_a_complete") {
      await prisma.user.update({ where: { id: user.id }, data: { onboardingStatus: "quiz_in_progress" } });
    }

    return NextResponse.json({ success: true });
  } catch (e) {
    return NextResponse.json({ error: "Failed to save answer" }, { status: 500 });
  }
}


