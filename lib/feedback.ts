import { prisma } from '@/lib/db';
import { logError } from '@/lib/logger';

export type FeedbackSentiment = 'frustrated' | 'feedback' | 'bug_report';

/**
 * Detect if user message indicates frustration or feedback request
 */
export function detectFeedbackIntent(userText: string): {
    isFeedback: boolean;
    sentiment: FeedbackSentiment | null;
} {
    const normalized = userText.toLowerCase().trim();

    // Frustrated patterns
    const frustratedPatterns = [
        /this (doesn't|doesnt|isn't|isnt) work/i,
        /not working/i,
        /broken/i,
        /(why|what) the (fuck|hell)/i,
        /useless/i,
        /frustrated/i,
        /annoying/i,
        /terrible/i,
        /worst/i,
    ];

    // Explicit feedback patterns
    const feedbackPatterns = [
        /feedback/i,
        /suggestion/i,
        /improve/i,
        /(can|could) you (add|make)/i,
        /feature request/i,
    ];

    // Bug report patterns
    const bugPatterns = [
        /bug/i,
        /error/i,
        /issue/i,
        /problem with/i,
        /glitch/i,
    ];

    if (frustratedPatterns.some(p => p.test(normalized))) {
        return { isFeedback: true, sentiment: 'frustrated' };
    }

    if (bugPatterns.some(p => p.test(normalized))) {
        return { isFeedback: true, sentiment: 'bug_report' };
    }

    if (feedbackPatterns.some(p => p.test(normalized))) {
        return { isFeedback: true, sentiment: 'feedback' };
    }

    return { isFeedback: false, sentiment: null };
}

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
                context: params.context ?? null,
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
