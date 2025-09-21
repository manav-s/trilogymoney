"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export default function OnboardingStep4() {
  const router = useRouter();
  const [isLoading, setIsLoading] = useState(false);

  const handleConnectBank = async () => {
    setIsLoading(true);
    
    try {
      // TODO: Implement Plaid Link integration
      // For now, simulate the process
      await new Promise(resolve => setTimeout(resolve, 2000));
      
      alert("Bank connection coming soon! This is a placeholder for Plaid integration.");
      router.push("/onboarding/5");
    } catch (error) {
      console.error("Error connecting bank:", error);
      alert("Failed to connect bank. Please try again.");
    } finally {
      setIsLoading(false);
    }
  };

  const handleSkip = () => {
    router.push("/onboarding/5");
  };

  return (
    <div className="bg-white dark:bg-gray-800 rounded-lg shadow-lg p-8">
      {/* Progress Bar */}
      <div className="mb-8">
        <div className="flex items-center justify-between text-sm text-gray-600 dark:text-gray-400 mb-2">
          <span>Step 4 of 5</span>
          <span>80% Complete</span>
        </div>
        <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-2">
          <div className="bg-indigo-600 h-2 rounded-full" style={{ width: "80%" }}></div>
        </div>
      </div>

      {/* Header */}
      <div className="text-center mb-8">
        <div className="text-4xl mb-4">🏦</div>
        <h1 className="text-2xl font-bold text-gray-900 dark:text-white mb-2">
          Connect Your Bank Account
        </h1>
        <p className="text-gray-600 dark:text-gray-400">
          Secure connection via Plaid to get your daily financial updates
        </p>
      </div>

      {/* Security Features */}
      <div className="space-y-4 mb-8">
        <div className="flex items-center p-4 bg-green-50 dark:bg-green-900/20 rounded-lg">
          <div className="text-green-600 dark:text-green-400 text-xl mr-3">🔒</div>
          <div>
            <h3 className="font-medium text-gray-900 dark:text-white">Bank-level security</h3>
            <p className="text-sm text-gray-600 dark:text-gray-400">
              256-bit encryption and secure data transmission
            </p>
          </div>
        </div>

        <div className="flex items-center p-4 bg-blue-50 dark:bg-blue-900/20 rounded-lg">
          <div className="text-blue-600 dark:text-blue-400 text-xl mr-3">📊</div>
          <div>
            <h3 className="font-medium text-gray-900 dark:text-white">Read-only access</h3>
            <p className="text-sm text-gray-600 dark:text-gray-400">
              We can only view your balance and transactions, never move money
            </p>
          </div>
        </div>

        <div className="flex items-center p-4 bg-purple-50 dark:bg-purple-900/20 rounded-lg">
          <div className="text-purple-600 dark:text-purple-400 text-xl mr-3">🏛️</div>
          <div>
            <h3 className="font-medium text-gray-900 dark:text-white">11,000+ banks supported</h3>
            <p className="text-sm text-gray-600 dark:text-gray-400">
              Works with major banks, credit unions, and financial institutions
            </p>
          </div>
        </div>
      </div>

      {/* Coming Soon Notice */}
      <div className="bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800 rounded-lg p-4 mb-8">
        <div className="flex items-center">
          <div className="text-yellow-600 dark:text-yellow-400 text-xl mr-3">🚧</div>
          <div>
            <h3 className="font-medium text-yellow-800 dark:text-yellow-200">
              Plaid Integration Coming Soon
            </h3>
            <p className="text-sm text-yellow-700 dark:text-yellow-300 mt-1">
              We're working on integrating with Plaid to securely connect your bank account. 
              This feature will be available in the next update!
            </p>
          </div>
        </div>
      </div>

      {/* Action Buttons */}
      <div className="space-y-4">
        <button
          onClick={handleConnectBank}
          disabled={isLoading}
          className="w-full bg-indigo-600 text-white py-3 px-4 rounded-lg font-medium hover:bg-indigo-700 focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
        >
          {isLoading ? "Connecting..." : "Connect Bank Account (Demo)"}
        </button>

        <button
          onClick={handleSkip}
          className="w-full border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 py-3 px-4 rounded-lg font-medium hover:bg-gray-50 dark:hover:bg-gray-700 focus:ring-2 focus:ring-gray-500 focus:ring-offset-2 transition-colors"
        >
          I'll connect later
        </button>
      </div>

      {/* Help Text */}
      <p className="text-xs text-gray-500 dark:text-gray-400 text-center mt-6">
        You can always connect your bank account later from your dashboard
      </p>
    </div>
  );
}
