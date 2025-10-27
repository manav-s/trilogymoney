import { prisma } from "./db";

export type OnboardingStatus =
  | "pre_auth"
  | "profile_collected"
  | "quiz_complete"
  | "analysis_complete"
  | "plaid_connected"
  | "subscribed"
  | "complete";

export async function getUserByPhone(phone: string) {
  return prisma.user.findUnique({ where: { phone } });
}

export function nextPathForStatus(status: OnboardingStatus): string {
  switch (status) {
    case "pre_auth":
      return "/onboard/step-a";
    case "profile_collected":
      return "/onboard/quiz";
    case "quiz_complete":
      return "/onboard/analyzing";
    case "analysis_complete":
      return "/onboard/plan";
    case "plaid_connected":
      return "/onboard/checkout";
    case "subscribed":
    case "complete":
      return "/dashboard";
    default:
      return "/";
  }
}
