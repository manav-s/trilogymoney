"use client";

import { SignUp, useUser } from "@clerk/nextjs";
import { useEffect } from "react";

/**
 * Clerk Sign-Up Page
 * This is a custom sign-up page that handles phone-based authentication
 * After sign-up completes, user is redirected to step-a
 */
export default function ClerkSignInPage() {
  const { isLoaded } = useUser();

  useEffect(() => {
    // Preload phone from magic link for Clerk's initialValues
    const phone = sessionStorage.getItem("onboarding_phone");
    if (phone) {
      console.log("[ClerkSignInPage] phone from magic link:", phone);
    }
  }, []);

  // Do not manually redirect; let Clerk handle it via afterSignIn/afterSignUp

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

  // Render sign-up form
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
            verify your phone
          </h2>
          <p className="text-sm text-gray-500 lowercase mt-2">
            we&apos;ll send you a verification code
          </p>
        </div>

        {/* Clerk Sign Up Component - Phone Only */}
        <SignUp
          appearance={{
            elements: {
              rootBox: "w-full",
              card: "shadow-none border-0",
              headerTitle: "hidden",
              headerSubtitle: "hidden",
              formFieldInput: "lowercase",
              phoneInputBox: "border-2 border-gray-300 rounded-2xl",
            },
            variables: {
              colorPrimary: "#4f46e5",
            },
          }}
          initialValues={{
            phoneNumber: typeof window !== 'undefined' ? sessionStorage.getItem("onboarding_phone") || "" : "",
          }}
          afterSignUpUrl="/onboard/step-a"
          afterSignInUrl="/onboard/step-a"
        />
      </div>
    </div>
  );
}
