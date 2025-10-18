"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { detectTimezone, US_TIMEZONES, getBrowserTimezone, getTimezoneAbbreviation } from "@/lib/timezone-detection";
const ONBOARDING_PHONE_KEY = "onboarding_phone";

export default function StepA() {
  const router = useRouter();
  const [phone, setPhone] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [formData, setFormData] = useState({
    name: "",
    timezone: "America/Los_Angeles",
  });
  const [showTimezoneSelect, setShowTimezoneSelect] = useState(false);

  // no-op logs in production

  useEffect(() => {
    // Get phone from sessionStorage
    const onboardingPhone = sessionStorage.getItem("onboarding_phone");
    if (!onboardingPhone) {
      router.push("/");
      return;
    }
    setPhone(onboardingPhone);

    // Prefer browser timezone; fallback to area code mapping
    const browserTz = getBrowserTimezone();
    if (browserTz) {
      setFormData((prev) => ({ ...prev, timezone: browserTz }));
    } else {
      const detected = detectTimezone(onboardingPhone);
      if (detected) {
        setFormData((prev) => ({ ...prev, timezone: detected.timezone }));
      } else {
        setShowTimezoneSelect(true);
      }
    }
  }, [router]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!phone) return;

    setIsLoading(true);

    try {
      // Update database with user info
      const response = await fetch("/api/onboard/update", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          phone,
          name: formData.name,
          timezone: formData.timezone,
          onboardingStatus: "step_a_complete",
        }),
      });

      if (!response.ok) {
        throw new Error("Failed to update user profile");
      }

      // Move to home (next step route not present in this branch)
      router.push("/");
    } catch (error: unknown) {
      alert((error as Error)?.message || "Failed to update profile");
      setIsLoading(false);
    }
  };

  // No auth gating; proceed with message-first onboarding

  // Wait for phone number to be loaded
  if (!phone) {
    return (
      <div className="min-h-screen bg-white flex items-center justify-center">
        <div className="text-center">
          <div className="w-8 h-8 border-4 border-indigo-600 border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
          <p className="text-gray-600 lowercase">loading your information...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-white">
      <div className="max-w-2xl mx-auto px-4 py-16">
        {/* Progress Bar */}
        <div className="mb-12">
          <div className="flex items-center justify-between text-sm text-gray-500 mb-2 lowercase">
            <span>step 1 of 3</span>
            <span>33% complete</span>
          </div>
          <div className="w-full bg-gray-200 rounded-full h-2">
            <div className="bg-indigo-600 h-2 rounded-full" style={{ width: "33%" }}></div>
          </div>
        </div>

        {/* Header */}
        <div className="text-center mb-12">
          <h1 className="text-4xl sm:text-5xl font-bold text-gray-900 mb-4 lowercase">
            let&apos;s get you set up
          </h1>
          <p className="text-xl text-gray-600 lowercase">
            just a few quick things to get started
          </p>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="space-y-6">
          {/* Name */}
          <div>
            <label htmlFor="name" className="block text-sm font-medium text-gray-700 mb-2 lowercase">
              your name
            </label>
            <input
              type="text"
              id="name"
              required
              value={formData.name}
              onChange={(e) => setFormData({ ...formData, name: e.target.value })}
              className="w-full px-6 py-4 text-lg rounded-2xl border-2 border-gray-300 bg-white text-gray-900 placeholder:text-gray-400 focus:border-indigo-600 focus:ring-4 focus:ring-indigo-600/20 outline-none transition-all lowercase"
              placeholder="john doe"
            />
          </div>


          {/* Timezone */}
          <div>
            <label htmlFor="timezone" className="block text-sm font-medium text-gray-700 mb-2 lowercase">
              your timezone
            </label>
            {!showTimezoneSelect ? (
              <div className="flex items-center justify-between p-4 bg-indigo-50 border border-indigo-100 rounded-2xl">
                <span className="text-gray-900">{getTimezoneAbbreviation(formData.timezone)}</span>
                <button
                  type="button"
                  onClick={() => setShowTimezoneSelect(true)}
                  className="text-sm text-indigo-600 hover:text-indigo-700 font-medium"
                >
                  change
                </button>
              </div>
            ) : (
              <select
                id="timezone"
                value={formData.timezone}
                onChange={(e) => setFormData({ ...formData, timezone: e.target.value })}
                className="w-full px-6 py-4 text-lg rounded-2xl border-2 border-gray-300 bg-white text-gray-900 focus:border-indigo-600 focus:ring-4 focus:ring-indigo-600/20 outline-none transition-all"
              >
                {US_TIMEZONES.map((tz) => {
                  const abbr = getTimezoneAbbreviation(tz.timezone);
                  return (
                    <option key={tz.timezone} value={tz.timezone}>
                      {tz.displayName.replace(/\((.*?)\)/, `(${abbr})`)}
                    </option>
                  );
                })}
              </select>
            )}
            <p className="text-sm text-gray-500 mt-2 lowercase">
              we detected this from your browser
            </p>
          </div>

          {/* Submit */}
          <button
            type="submit"
            disabled={isLoading}
            className="w-full px-10 py-5 text-xl font-semibold rounded-full bg-indigo-600 text-white hover:bg-indigo-700 focus:ring-4 focus:ring-indigo-600/20 transition-all lowercase shadow-lg hover:shadow-xl hover:-translate-y-0.5 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {isLoading ? "creating account..." : "continue →"}
          </button>
        </form>
      </div>
    </div>
  );
}

