import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { phone, name, timezone, onboardingStatus } = body;

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

    console.log(`[Onboarding.StepA] User updated: ${updatedUser.id}`);

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
    console.error("[Onboarding.Update] Error:", error);
    return NextResponse.json(
      { error: "Failed to update user" },
      { status: 500 }
    );
  }
}
