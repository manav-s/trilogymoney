"use client";

import { SignIn, useUser } from "@clerk/nextjs";
import { useRouter } from "next/navigation";

/**
 * Alternative Clerk Sign-In Page using SignIn component
 * This might work better if phone verification is causing issues
 */
export default function ClerkSignInPage() {
  const router = useRouter();
  const { isSignedIn, isLoaded } = useUser();

  // If already signed in, redirect to next step
  if (isLoaded && isSignedIn) {
    router.push("/onboard/step-a");
    return (
      <div className="min-h-screen bg-white flex items-center justify-center">
        <div className="text-center">
          <div className="w-8 h-8 border-4 border-indigo-600 border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
          <p className="text-gray-600 lowercase">redirecting...</p>
        </div>
      </div>
    );
  }

  // Show loading state while Clerk loads
  if (!isLoaded) {
    return (
      <div className="min-h-screen bg-white flex items-center justify-center">
        <div className="text-center">
          <div className="w-8 h-8 border-4 border-indigo-600 border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
          <p className="text-gray-600 lowercase">loading...</p>
        </div>
      </div>
    );
  }

  // Render sign-in form with option to sign up
  return (
    <div className="min-h-screen bg-white flex items-center justify-center p-4">
      <div className="max-w-md w-full">
        {/* Trilogy Branding */}
        <div className="text-center mb-12">
          <div className="mb-8">
            <h1 className="text-6xl font-bold text-gray-900 lowercase tracking-tight">
              trilogy
            </h1>
            <p className="text-sm text-gray-500 lowercase mt-2">
              your money&apos;s personal assistant
            </p>
          </div>
          
          <h2 className="text-3xl font-bold text-gray-900 lowercase">
            sign in or create account
          </h2>
        </div>

        {/* Clerk Sign In Component with Sign Up option */}
        <SignIn
          appearance={{
            elements: {
              rootBox: "w-full",
              card: "shadow-none border-0",
              headerTitle: "hidden",
              headerSubtitle: "hidden",
            },
          }}
          routing="path"
          path="/onboard/clerk-signin"
          signUpUrl="/onboard/clerk-signin"
          afterSignInUrl="/onboard/step-a"
          afterSignUpUrl="/onboard/step-a"
        />
      </div>
    </div>
  );
}
