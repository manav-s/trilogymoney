"use client";

import { useRouter } from "next/navigation";
import { useUser } from "@clerk/nextjs";

export default function OnboardingStep5() {
  const router = useRouter();
  const { user } = useUser();

  const handleGoToDashboard = () => {
    router.push("/dashboard");
  };

  return (
    <div className="bg-white dark:bg-gray-800 rounded-lg shadow-lg p-8">
      {/* Progress Bar */}
      <div className="mb-8">
        <div className="flex items-center justify-between text-sm text-gray-600 dark:text-gray-400 mb-2">
          <span>Step 5 of 5</span>
          <span>100% Complete</span>
        </div>
        <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-2">
          <div className="bg-green-600 h-2 rounded-full" style={{ width: "100%" }}></div>
        </div>
      </div>

      {/* Success Message */}
      <div className="text-center mb-8">
        <div className="text-6xl mb-6">🎉</div>
        <h1 className="text-3xl font-bold text-gray-900 dark:text-white mb-4">
          You're all set!
        </h1>
        <p className="text-lg text-gray-600 dark:text-gray-400 mb-8">
          Welcome to 3Numbers, {user?.firstName || 'there'}! Your daily financial awareness journey starts now.
        </p>
      </div>

      {/* Setup Summary */}
      <div className="space-y-4 mb-8">
        <div className="flex items-center p-3 bg-green-50 dark:bg-green-900/20 rounded-lg">
          <div className="text-green-600 dark:text-green-400 text-xl mr-3">✓</div>
          <span className="text-gray-900 dark:text-white font-medium">Profile complete</span>
        </div>

        <div className="flex items-center p-3 bg-green-50 dark:bg-green-900/20 rounded-lg">
          <div className="text-green-600 dark:text-green-400 text-xl mr-3">✓</div>
          <span className="text-gray-900 dark:text-white font-medium">Phone number ready</span>
        </div>

        <div className="flex items-center p-3 bg-green-50 dark:bg-green-900/20 rounded-lg">
          <div className="text-green-600 dark:text-green-400 text-xl mr-3">✓</div>
          <span className="text-gray-900 dark:text-white font-medium">Daily messages configured</span>
        </div>

        <div className="flex items-center p-3 bg-yellow-50 dark:bg-yellow-900/20 rounded-lg">
          <div className="text-yellow-600 dark:text-yellow-400 text-xl mr-3">⏳</div>
          <span className="text-gray-900 dark:text-white font-medium">Bank connection pending</span>
        </div>
      </div>

      {/* Next Steps */}
      <div className="bg-blue-50 dark:bg-blue-900/20 rounded-lg p-6 mb-8">
        <h3 className="font-semibold text-blue-900 dark:text-blue-200 mb-3">
          What happens next?
        </h3>
        <ul className="space-y-2 text-sm text-blue-800 dark:text-blue-300">
          <li className="flex items-start">
            <span className="text-blue-600 dark:text-blue-400 mr-2">📱</span>
            <span>Your first message will arrive tomorrow morning</span>
          </li>
          <li className="flex items-start">
            <span className="text-blue-600 dark:text-blue-400 mr-2">🏦</span>
            <span>Connect your bank account to start receiving real financial data</span>
          </li>
          <li className="flex items-start">
            <span className="text-blue-600 dark:text-blue-400 mr-2">⚙️</span>
            <span>Adjust your preferences anytime from your dashboard</span>
          </li>
        </ul>
      </div>

      {/* Message Preview */}
      <div className="bg-gray-900 rounded-lg p-4 mb-8">
        <p className="text-gray-400 text-sm mb-2">Your daily message will look like this:</p>
        <div className="bg-green-600 text-white p-3 rounded-lg max-w-xs font-mono text-sm">
          <div className="whitespace-pre-line">
            📱 3Numbers Daily Update{'\n'}
            Bank Balance: $2,547.83{'\n'}
            Yesterday: -$47.20{'\n'}
            This Week: -$312.45
          </div>
        </div>
      </div>

      {/* Action Button */}
      <button
        onClick={handleGoToDashboard}
        className="w-full bg-indigo-600 text-white py-4 px-6 rounded-lg text-lg font-semibold hover:bg-indigo-700 focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2 transition-colors"
      >
        Go to Dashboard →
      </button>

      {/* Help Text */}
      <p className="text-xs text-gray-500 dark:text-gray-400 text-center mt-6">
        Need help? Check out our dashboard for settings and support options
      </p>
    </div>
  );
}
