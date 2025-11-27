import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db/db';

export async function GET(req: NextRequest) {
    // Add authentication here (e.g., API key check)
    const authHeader = req.headers.get('authorization');
    if (authHeader !== `Bearer ${process.env.ADMIN_API_KEY}`) {
        return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
    }

    const resolved = req.nextUrl.searchParams.get('resolved') === 'true';
    const limit = Number(req.nextUrl.searchParams.get('limit')) || 50;

    const feedback = await prisma.feedback.findMany({
        where: resolved !== undefined ? { resolved } : undefined,
        orderBy: { createdAt: 'desc' },
        take: limit,
    });

    // Manually fetch user data for each feedback
    const feedbackWithUsers = await Promise.all(
        feedback.map(async (fb) => {
            const user = await prisma.user.findUnique({
                where: { id: fb.userId },
                select: {
                    id: true,
                    phone: true,
                    email: true,
                    name: true,
                },
            });
            return { ...fb, user };
        })
    );

    return NextResponse.json({ feedback: feedbackWithUsers, count: feedbackWithUsers.length });
}

export async function PATCH(req: NextRequest) {
    // Mark feedback as resolved
    const authHeader = req.headers.get('authorization');
    if (authHeader !== `Bearer ${process.env.ADMIN_API_KEY}`) {
        return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
    }

    const body = await req.json();
    const { feedbackId, resolved, notes } = body;

    const updated = await prisma.feedback.update({
        where: { id: feedbackId },
        data: {
            resolved: resolved ?? undefined,
            notes: notes ?? undefined,
        },
    });

    return NextResponse.json({ success: true, feedback: updated });
}
