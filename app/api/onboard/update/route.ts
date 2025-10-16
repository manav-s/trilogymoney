import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { z } from "zod";

const updateSchema = z.object({
  phone: z.string().min(10),
  name: z.string().min(1),
  timezone: z.string().min(1),
  onboardingStatus: z.string().min(1),
});

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { phone, name, timezone, onboardingStatus } = updateSchema.parse(body);

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
    const updatedUser = await prisma.user.update({
      where: { phone },
      data: {
        name,
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
  } catch (error) {
    return NextResponse.json({ error: "Failed to update user" }, { status: 500 });
  }
}
