"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { useUser } from "@clerk/nextjs";
import { 
  guessTimezoneFromPhone, 
  getTimezoneDisplayName, 
  allTimezones 
} from "@/lib/timezone-detection";

export default function OnboardingStep1() {
  const router = useRouter();
  const { user } = useUser();
  const [isLoading, setIsLoading] = useState(false);
  const [formData, setFormData] = useState({
    name: user?.fullName || "",
    timezone: "America/New_York"
  });
  const [guessedTimezone, setGuessedTimezone] = useState<string | null>(null);
  const [showTimezoneConfirmation, setShowTimezoneConfirmation] = useState(false);
  const [showTimezoneDropdown, setShowTimezoneDropdown] = useState(false);

  // Guess timezone from phone number when component mounts
  useEffect(() => {
    if (user?.phoneNumbers?.[0]?.phoneNumber) {
      const phoneNumber = user.phoneNumbers[0].phoneNumber;
      const guessed = guessTimezoneFromPhone(phoneNumber);
      
      if (guessed) {
        setGuessedTimezone(guessed);
        setFormData(prev => ({ ...prev, timezone: guessed }));
        setShowTimezoneConfirmation(true);
      } else {
        // No guess possible, show dropdown
        setShowTimezoneDropdown(true);
      }
    } else {
      // No phone number, show dropdown
      setShowTimezoneDropdown(true);
    }
  }, [user]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);

    try {
      // Update user profile in database
      const response = await fetch("/api/users", {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(formData),
      });

      if (response.ok) {
        router.push("/onboarding/2");
      } else {
        throw new Error("Failed to update profile");
      }
    } catch (error) {
      console.error("Error updating profile:", error);
      alert("Failed to update profile. Please try again.");
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="bg-white dark:bg-gray-800 rounded-lg shadow-lg p-8">
      {/* Progress Bar */}
      <div className="mb-8">
        <div className="flex items-center justify-between text-sm text-gray-600 dark:text-gray-400 mb-2">
          <span>Step 1 of 5</span>
          <span>20% Complete</span>
        </div>
        <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-2">
          <div className="bg-indigo-600 h-2 rounded-full" style={{ width: "20%" }}></div>
        </div>
      </div>

      {/* Welcome Message */}
      <div className="text-center mb-8">
        <h1 className="text-2xl font-bold text-gray-900 dark:text-white mb-2">
          Welcome to 3Numbers! 👋
        </h1>
        <p className="text-gray-600 dark:text-gray-400">
          Let's get your daily SMS updates set up. First, tell us about yourself.
        </p>
      </div>

      {/* Form */}
      <form onSubmit={handleSubmit} className="space-y-6">
        {/* Full Name */}
        <div>
          <label htmlFor="name" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
            Full Name
          </label>
          <input
            type="text"
            id="name"
            required
            value={formData.name}
            onChange={(e) => setFormData({ ...formData, name: e.target.value })}
            className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 dark:bg-gray-700 dark:text-white"
            placeholder="Enter your full name"
          />
        </div>


        {/* Timezone */}
        <div>
          <label htmlFor="timezone" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
            Timezone
          </label>
          
          {showTimezoneConfirmation && guessedTimezone && (
            <div className="space-y-3">
              <div className="flex items-center p-3 bg-blue-50 dark:bg-blue-900/20 rounded-lg border border-blue-200 dark:border-blue-800">
                <div className="flex-1">
                  <p className="text-sm text-blue-800 dark:text-blue-200">
                    Based on your phone number, are you in <span className="font-semibold">{getTimezoneDisplayName(guessedTimezone)}</span>?
                  </p>
                </div>
              </div>
              
              <div className="flex space-x-3">
                <button
                  type="button"
                  onClick={() => {
                    setShowTimezoneConfirmation(false);
                    // Keep the guessed timezone
                  }}
                  className="flex-1 bg-green-600 text-white py-2 px-4 rounded-lg font-medium hover:bg-green-700 focus:ring-2 focus:ring-green-500 focus:ring-offset-2 transition-colors"
                >
                  Yes, that's correct
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setShowTimezoneConfirmation(false);
                    setShowTimezoneDropdown(true);
                  }}
                  className="flex-1 border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 py-2 px-4 rounded-lg font-medium hover:bg-gray-50 dark:hover:bg-gray-700 focus:ring-2 focus:ring-gray-500 focus:ring-offset-2 transition-colors"
                >
                  No, let me choose
                </button>
              </div>
            </div>
          )}
          
          {showTimezoneDropdown && (
            <select
              id="timezone"
              value={formData.timezone}
              onChange={(e) => setFormData({ ...formData, timezone: e.target.value })}
              className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 dark:bg-gray-700 dark:text-white"
            >
              {allTimezones.map((tz) => (
                <option key={tz.value} value={tz.value}>
                  {tz.label}
                </option>
              ))}
            </select>
          )}
          
          {!showTimezoneConfirmation && !showTimezoneDropdown && (
            <div className="flex items-center p-3 bg-gray-50 dark:bg-gray-700 rounded-lg">
              <span className="text-gray-600 dark:text-gray-400">
                Selected: {getTimezoneDisplayName(formData.timezone)}
              </span>
              <button
                type="button"
                onClick={() => setShowTimezoneDropdown(true)}
                className="ml-auto text-indigo-600 dark:text-indigo-400 text-sm hover:text-indigo-500"
              >
                Change
              </button>
            </div>
          )}
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
        {showTimezoneConfirmation 
          ? "We detected your timezone from your area code to ensure perfect SMS delivery timing"
          : "We use your timezone to deliver your daily SMS at the perfect time"
        }
      </p>
    </div>
  );
}
