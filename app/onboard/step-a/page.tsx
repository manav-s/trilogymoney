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
    email: "",
    timezone: "America/Los_Angeles",
  });


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
          email: formData.email,
          timezone: formData.timezone,
          onboardingStatus: "step_a_complete",
        }),
      });

      if (!response.ok) {
        throw new Error("Failed to update user profile");
      }

      // Move to quiz (next step)
      router.push("/onboard/quiz");
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
    <div className="min-h-screen bg-gray-50 relative overflow-hidden">
      <div className="absolute top-0 left-0 w-full h-full bg-[radial-gradient(#e5e7eb_1px,transparent_1px)] [background-size:16px_16px] [mask-image:radial-gradient(ellipse_50%_50%_at_50%_50%,#000_70%,transparent_100%)] opacity-50"></div>
      <div className="max-w-2xl mx-auto px-4 py-16 relative z-10">
        {/* Progress Bar */}
        <div className="mb-12">
          <div className="flex items-center justify-between text-sm text-gray-500 mb-2 lowercase">
            <span>step 1 of 3</span>
            <span>33% complete</span>
          </div>
          <div className="w-full bg-gray-200/50 rounded-full h-2 backdrop-blur-sm">
            <div className="bg-blue-600 h-2 rounded-full transition-all duration-500 ease-out shadow-[0_0_10px_rgba(37,99,235,0.3)]" style={{ width: "33%" }}></div>
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
              className="w-full px-6 py-5 text-lg rounded-2xl border border-white/20 bg-white/60 backdrop-blur-xl text-gray-900 placeholder:text-gray-400 focus:bg-white focus:border-blue-500 focus:ring-4 focus:ring-blue-500/10 outline-none transition-all duration-300 lowercase shadow-sm hover:bg-white/80 focus:shadow-lg"
              placeholder="john doe"
            />
          </div>


          {/* Email */}
          <div>
            <label htmlFor="email" className="block text-sm font-medium text-gray-700 mb-2 lowercase">
              your email
            </label>
            <input
              type="email"
              id="email"
              required
              value={formData.email}
              onChange={(e) => setFormData({ ...formData, email: e.target.value.trim().toLowerCase() })}
              className="w-full px-6 py-5 text-lg rounded-2xl border border-white/20 bg-white/60 backdrop-blur-xl text-gray-900 placeholder:text-gray-400 focus:bg-white focus:border-blue-500 focus:ring-4 focus:ring-blue-500/10 outline-none transition-all duration-300 shadow-sm hover:bg-white/80 focus:shadow-lg"
              placeholder="you@example.com"
            />
            <p className="text-sm text-gray-500 mt-2 lowercase">required — used for receipts and alerts</p>
          </div>



          {/* Submit */}
          <button
            type="submit"
            disabled={isLoading}
            className="w-full px-10 py-5 text-xl font-semibold rounded-full bg-blue-600 text-white hover:bg-blue-700 focus:ring-4 focus:ring-blue-600/20 transition-all duration-300 lowercase shadow-lg hover:shadow-blue-500/30 hover:-translate-y-1 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {isLoading ? "creating account..." : "continue →"}
          </button>
        </form>
      </div>
    </div>
  );
}

