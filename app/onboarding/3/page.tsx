"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export default function OnboardingStep3() {
  const router = useRouter();
  const [isLoading, setIsLoading] = useState(false);
  const [messageTime, setMessageTime] = useState(8); // 8 AM default
  // Daily messages are always enabled - this is the core value of 3Numbers
  const messageEnabled = true;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);

    try {
      const response = await fetch("/api/users", {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          messageTime,
          messageEnabled,
        }),
      });

      if (response.ok) {
        router.push("/onboarding/4");
      } else {
        throw new Error("Failed to update preferences");
      }
    } catch (error) {
      console.error("Error updating preferences:", error);
      alert("Failed to update preferences. Please try again.");
    } finally {
      setIsLoading(false);
    }
  };

  const formatTime = (hour: number) => {
    const period = hour >= 12 ? "PM" : "AM";
    const displayHour = hour === 0 ? 12 : hour > 12 ? hour - 12 : hour;
    return `${displayHour}:00 ${period}`;
  };

  const generatePreviewMessage = () => {
    const balanceExample = "$2,547.83";
    const yesterdayExample = "-$47.20";
    const weekExample = "-$312.45";
    
    return `📱 3Numbers Daily Update\nBank Balance: ${balanceExample}\nYesterday: ${yesterdayExample}\nThis Week: ${weekExample}`;
  };

  return (
    <div className="bg-white dark:bg-gray-800 rounded-lg shadow-lg p-8">
      {/* Progress Bar */}
      <div className="mb-8">
        <div className="flex items-center justify-between text-sm text-gray-600 dark:text-gray-400 mb-2">
          <span>Step 2 of 4</span>
          <span>50% Complete</span>
        </div>
        <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-2">
          <div className="bg-indigo-600 h-2 rounded-full" style={{ width: "50%" }}></div>
        </div>
      </div>

      {/* Header */}
      <div className="text-center mb-8">
        <div className="text-4xl mb-4">⏰</div>
        <h1 className="text-2xl font-bold text-gray-900 dark:text-white mb-2">
          When should we text you?
        </h1>
        <p className="text-gray-600 dark:text-gray-400">
          Choose the perfect time for your daily financial update
        </p>
      </div>

      <form onSubmit={handleSubmit} className="space-y-8">
        {/* Time Selection */}
        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-4">
            Delivery Time
          </label>
          <div className="flex items-center justify-center">
            <input
              type="range"
              min="6"
              max="22"
              value={messageTime}
              onChange={(e) => setMessageTime(parseInt(e.target.value))}
              className="w-full h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer dark:bg-gray-700 slider"
            />
          </div>
          <div className="text-center mt-4">
            <div className="text-3xl font-bold text-indigo-600 dark:text-indigo-400">
              {formatTime(messageTime)}
            </div>
            <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
              Daily delivery time
            </p>
          </div>
        </div>

        {/* Message Preview */}
        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-4">
            Message Preview
          </label>
          <div className="bg-gray-900 rounded-lg p-4 font-mono text-sm">
            <div className="bg-green-600 text-white p-3 rounded-lg max-w-xs">
              <div className="whitespace-pre-line">{generatePreviewMessage()}</div>
            </div>
            <p className="text-gray-400 text-xs mt-2">
              Delivered daily at {formatTime(messageTime)}
            </p>
          </div>
        </div>

        {/* Daily Messages Info */}
        <div className="flex items-center p-4 bg-green-50 dark:bg-green-900/20 rounded-lg border border-green-200 dark:border-green-800">
          <div className="flex-shrink-0">
            <span className="text-green-600 dark:text-green-400 text-xl">✓</span>
          </div>
          <div className="ml-3">
            <h3 className="font-medium text-green-800 dark:text-green-200">
              Daily Messages Enabled
            </h3>
            <p className="text-sm text-green-700 dark:text-green-300">
              You'll receive your 3 key financial numbers every day at {formatTime(messageTime)}
            </p>
          </div>
        </div>

        {/* Submit Button */}
        <button
          type="submit"
          disabled={isLoading}
          className="w-full bg-indigo-600 text-white py-3 px-4 rounded-lg font-medium hover:bg-indigo-700 focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
        >
          {isLoading ? "Saving..." : "Continue →"}
        </button>
      </form>

      {/* Help Text */}
      <p className="text-xs text-gray-500 dark:text-gray-400 text-center mt-6">
        You can change your delivery time anytime in your dashboard
      </p>

      <style jsx>{`
        .slider::-webkit-slider-thumb {
          appearance: none;
          height: 20px;
          width: 20px;
          border-radius: 50%;
          background: #4f46e5;
          cursor: pointer;
        }
        
        .slider::-moz-range-thumb {
          height: 20px;
          width: 20px;
          border-radius: 50%;
          background: #4f46e5;
          cursor: pointer;
          border: none;
        }
      `}</style>
    </div>
  );
}
