import { redirect } from "next/navigation";

export default function OnboardingRedirect() {
  // Redirect to step 1 by default
  redirect("/onboarding/1");
}
