"use client";

import { useState, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import { useUser } from "@clerk/nextjs";

export default function OnboardingStep2() {
  const router = useRouter();
  const { user } = useUser();
  const [phoneNumber, setPhoneNumber] = useState("");
  const [verificationCode, setVerificationCode] = useState("");
  const [isCodeSent, setIsCodeSent] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [countdown, setCountdown] = useState(0);
  const [isAlreadyVerified, setIsAlreadyVerified] = useState(false);

  // Get phone number from Clerk user and check verification status
  useEffect(() => {
    if (user?.phoneNumbers?.[0]) {
      const clerkPhone = user.phoneNumbers[0];
      setPhoneNumber(clerkPhone.phoneNumber);
      
      // If phone is already verified in Clerk, skip verification step
      if (clerkPhone.verification?.status === 'verified') {
        setIsAlreadyVerified(true);
        // Auto-redirect after 2 seconds
        setTimeout(() => {
          handleVerifySuccess();
        }, 2000);
      } else {
        // Phone exists but not verified, show verification UI
        setIsCodeSent(false);
      }
    }
  }, [user, handleVerifySuccess]);

  // Countdown timer for resend
  useEffect(() => {
    if (countdown > 0) {
      const timer = setTimeout(() => setCountdown(countdown - 1), 1000);
      return () => clearTimeout(timer);
    }
  }, [countdown]);

  const handleSendCode = async () => {
    setIsLoading(true);
    try {
      // TODO: Implement Twilio SMS sending
      // For now, simulate sending
      await new Promise(resolve => setTimeout(resolve, 1000));
      setIsCodeSent(true);
      setCountdown(60);
      alert("Verification code sent! (This is a placeholder - Twilio integration coming soon)");
    } catch (error) {
      console.error("Error sending code:", error);
      alert("Failed to send verification code. Please try again.");
    } finally {
      setIsLoading(false);
    }
  };

  const handleVerifyCode = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);

    try {
      // TODO: Implement actual SMS verification
      // For now, accept any 6-digit code
      if (verificationCode.length === 6) {
        await handleVerifySuccess();
      } else {
        throw new Error("Please enter a 6-digit code");
      }
    } catch (error) {
      console.error("Error verifying code:", error);
      alert("Invalid verification code. Please try again.");
    } finally {
      setIsLoading(false);
    }
  };

  const handleSkip = () => {
    router.push("/onboarding/3");
  };

  const handleVerifySuccess = useCallback(async () => {
    try {
      // Update user verification status in database
      await fetch("/api/users", {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ isVerified: true }),
      });

      // Move to next step
      router.push("/onboarding/3");
    } catch (error) {
      console.error("Error updating verification status:", error);
      // Continue anyway - verification status can be updated later
      router.push("/onboarding/3");
    }
  }, [router]);

  return (
    <div className="bg-white dark:bg-gray-800 rounded-lg shadow-lg p-8">
      {/* Progress Bar */}
      <div className="mb-8">
        <div className="flex items-center justify-between text-sm text-gray-600 dark:text-gray-400 mb-2">
          <span>Step 2 of 5</span>
          <span>40% Complete</span>
        </div>
        <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-2">
          <div className="bg-indigo-600 h-2 rounded-full" style={{ width: "40%" }}></div>
        </div>
      </div>

      {/* Header */}
      <div className="text-center mb-8">
        <div className="text-4xl mb-4">📱</div>
        <h1 className="text-2xl font-bold text-gray-900 dark:text-white mb-2">
          Phone Number Verification
        </h1>
        <p className="text-gray-600 dark:text-gray-400">
          {isAlreadyVerified
            ? "Your phone number is already verified! Redirecting..."
            : "We'll send your daily financial updates to this number"
          }
        </p>
      </div>

      {isAlreadyVerified ? (
        /* Already Verified State */
        <div className="space-y-6">
          <div className="flex items-center p-4 bg-green-50 dark:bg-green-900/20 rounded-lg border border-green-200 dark:border-green-800">
            <div className="text-green-600 dark:text-green-400 text-2xl mr-3">✓</div>
            <div>
              <h3 className="font-medium text-green-800 dark:text-green-200">
                Phone Number Verified
              </h3>
              <p className="text-sm text-green-700 dark:text-green-300 mt-1">
                {phoneNumber} is ready to receive your daily updates
              </p>
            </div>
          </div>
          
          <div className="text-center">
            <div className="inline-flex items-center space-x-2 text-gray-600 dark:text-gray-400">
              <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-indigo-600"></div>
              <span className="text-sm">Continuing to next step...</span>
            </div>
          </div>
          
          <button
            onClick={() => handleVerifySuccess()}
            className="w-full bg-indigo-600 text-white py-3 px-4 rounded-lg font-medium hover:bg-indigo-700 focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2 transition-colors"
          >
            Continue Now →
          </button>
        </div>
      ) : (
        <>
        {!isCodeSent ? (
        /* Send Code Step */
        <div className="space-y-6">
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              Phone Number
            </label>
            <div className="flex items-center p-3 bg-gray-50 dark:bg-gray-700 rounded-lg">
              <span className="text-green-600 mr-2">✓</span>
              <span className="text-gray-900 dark:text-white font-medium">
                {phoneNumber || "No phone number found"}
              </span>
            </div>
            <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
              This phone number is from your account signup
            </p>
          </div>

          <button
            onClick={handleSendCode}
            disabled={isLoading || !phoneNumber}
            className="w-full bg-indigo-600 text-white py-3 px-4 rounded-lg font-medium hover:bg-indigo-700 focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            {isLoading ? "Sending..." : "Send Verification Code"}
          </button>

          <button
            onClick={handleSkip}
            className="w-full text-gray-600 dark:text-gray-400 py-2 px-4 text-sm hover:text-gray-800 dark:hover:text-gray-200"
          >
            Skip for now
          </button>
        </div>
      ) : (
        /* Verify Code Step */
        <form onSubmit={handleVerifyCode} className="space-y-6">
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              Enter 6-digit verification code
            </label>
            <input
              type="text"
              maxLength={6}
              pattern="[0-9]{6}"
              value={verificationCode}
              onChange={(e) => setVerificationCode(e.target.value.replace(/\D/g, ''))}
              className="w-full px-3 py-3 text-center text-2xl font-mono border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 dark:bg-gray-700 dark:text-white tracking-widest"
              placeholder="000000"
              autoComplete="one-time-code"
            />
            <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
              Code sent to {phoneNumber}
            </p>
          </div>

          <button
            type="submit"
            disabled={isLoading || verificationCode.length !== 6}
            className="w-full bg-indigo-600 text-white py-3 px-4 rounded-lg font-medium hover:bg-indigo-700 focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            {isLoading ? "Verifying..." : "Verify & Continue →"}
          </button>

          <div className="text-center">
            {countdown > 0 ? (
              <p className="text-sm text-gray-500 dark:text-gray-400">
                Resend code in {countdown}s
              </p>
            ) : (
              <button
                type="button"
                onClick={handleSendCode}
                disabled={isLoading}
                className="text-sm text-indigo-600 dark:text-indigo-400 hover:text-indigo-500"
              >
                Resend Code
              </button>
            )}
          </div>

          <button
            type="button"
            onClick={handleSkip}
            className="w-full text-gray-600 dark:text-gray-400 py-2 px-4 text-sm hover:text-gray-800 dark:hover:text-gray-200"
          >
            Skip for now
          </button>
        </form>
      )}
        </>
      )}

      {/* Help Text */}
      <p className="text-xs text-gray-500 dark:text-gray-400 text-center mt-6">
        {isAlreadyVerified 
          ? "Since you signed up with this number, we know it works!"
          : "SMS verification ensures reliable delivery of your daily updates"
        }
      </p>
    </div>
  );
}
