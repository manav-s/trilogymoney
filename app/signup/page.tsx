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

        {/* Sign up form will be implemented with Clerk */}
        <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-xl p-8">
          <div className="text-center py-12">
            <div className="w-16 h-16 bg-indigo-100 dark:bg-indigo-900 rounded-full flex items-center justify-center mx-auto mb-4">
              <span className="text-indigo-600 dark:text-indigo-400 text-2xl">🚀</span>
            </div>
            <h3 className="text-xl font-semibold text-gray-900 dark:text-white mb-2">
              Coming Soon
            </h3>
            <p className="text-gray-600 dark:text-gray-300 mb-6">
              Authentication system will be implemented with Clerk in the next step.
            </p>
            <Link
              href="/"
              className="inline-flex items-center text-indigo-600 hover:text-indigo-700 dark:text-indigo-400 dark:hover:text-indigo-300 font-medium"
            >
              ← Back to home
            </Link>
          </div>
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
