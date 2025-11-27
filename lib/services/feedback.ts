import { Prisma } from '@prisma/client';
import { prisma } from '@/lib/db/db';
import { logError } from '@/lib/utils/logger';

export type FeedbackSentiment = 'frustrated' | 'feedback' | 'bug_report';

/**
 * Capture user feedback to database
 */
export async function captureFeedback(params: {
    userId: string;
    userMessage: string;
    sentiment: FeedbackSentiment;
    context?: unknown;
}): Promise<{ success: boolean; feedbackId?: string }> {
    try {
        const feedback = await prisma.feedback.create({
            data: {
                userId: params.userId,
                userMessage: params.userMessage,
                sentiment: params.sentiment,
                context: params.context ? (params.context as Prisma.InputJsonValue) : undefined,
            },
        });

        console.info('feedback.captured', {
            feedbackId: feedback.id,
            userId: params.userId,
            sentiment: params.sentiment,
        });

        return { success: true, feedbackId: feedback.id };
    } catch (error) {
        logError('feedback.capture', error, { userId: params.userId });
        return { success: false };
    }
}
