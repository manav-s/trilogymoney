import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { z } from "zod";

const updateSchema = z.object({
  phone: z.string().min(10),
  name: z.string().min(1),
  email: z.string().email().max(254),
  timezone: z.string().min(1),
  onboardingStatus: z.string().min(1),
});

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const parsed = updateSchema.parse(body);
    const phone = parsed.phone;
    const name = parsed.name;
    const email = parsed.email.trim().toLowerCase();
    const timezone = parsed.timezone;
    const onboardingStatus = parsed.onboardingStatus;

    if (!phone) {
      return NextResponse.json(
        { error: "Phone number is required" },
        { status: 400 }
      );
    }

    // Find existing user by phone
    const existingUser = await prisma.user.findUnique({
      where: { phone },
    });

    if (!existingUser) {
      return NextResponse.json(
        { error: "User not found" },
        { status: 404 }
      );
    }

    // Update user profile information
    try {
      const updatedUser = await prisma.user.update({
        where: { phone },
        data: {
          name,
          email,
          timezone,
          onboardingStatus,
        },
      });

      return NextResponse.json({
        success: true,
        user: {
          id: updatedUser.id,
          phone: updatedUser.phone,
          name: updatedUser.name,
          onboardingStatus: updatedUser.onboardingStatus,
        },
      });
    } catch (e: unknown) {
      // Prisma unique constraint violation
      if (typeof e === 'object' && e && (e as any).code === 'P2002') {
        return NextResponse.json({ error: 'email already in use' }, { status: 409 });
      }
      throw e;
    }
  } catch (error) {
    return NextResponse.json({ error: "Failed to update user" }, { status: 500 });
  }
}
