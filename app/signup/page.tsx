import { SignUp } from "@clerk/nextjs";
import Link from "next/link";

export default function SignUpPage() {
  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 dark:from-gray-900 dark:to-gray-800 flex items-center justify-center p-4">
      <div className="max-w-md w-full space-y-8">
        {/* Header */}
        <div className="text-center">
          <Link href="/" className="text-2xl font-bold text-indigo-600 dark:text-indigo-400">
            3Numbers
          </Link>
          <h2 className="mt-6 text-3xl font-bold text-gray-900 dark:text-white">
            Start your free trial
          </h2>
          <p className="mt-2 text-gray-600 dark:text-gray-300">
            Get your daily financial awareness in just 3 numbers
          </p>
        </div>

        {/* Clerk Sign Up Component */}
        <div className="flex justify-center">
          <SignUp 
            appearance={{
              elements: {
                rootBox: "mx-auto",
                card: "bg-white dark:bg-gray-800 shadow-xl"
              }
            }}
          />
        </div>

        {/* Trial info */}
        <div className="text-center">
          <p className="text-sm text-gray-500 dark:text-gray-400">
            🎉 3-day free trial • No credit card required
          </p>
        </div>
      </div>
    </div>
  );
}
