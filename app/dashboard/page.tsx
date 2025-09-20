import Link from "next/link";

export default function DashboardPage() {
  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
      {/* Navigation */}
      <nav className="bg-white dark:bg-gray-800 shadow">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between h-16">
            <div className="flex items-center">
              <Link href="/" className="text-2xl font-bold text-indigo-600 dark:text-indigo-400">
                3Numbers
              </Link>
            </div>
            <div className="flex items-center space-x-4">
              <span className="text-gray-700 dark:text-gray-300">Welcome back!</span>
              <button className="bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-gray-300 px-3 py-2 rounded-md text-sm">
                Sign Out
              </button>
            </div>
          </div>
        </div>
      </nav>

      <main className="max-w-7xl mx-auto py-6 sm:px-6 lg:px-8">
        <div className="px-4 py-6 sm:px-0">
          {/* Coming Soon Message */}
          <div className="text-center py-20">
            <div className="w-20 h-20 bg-indigo-100 dark:bg-indigo-900 rounded-full flex items-center justify-center mx-auto mb-6">
              <span className="text-indigo-600 dark:text-indigo-400 text-3xl">📊</span>
            </div>
            <h1 className="text-3xl font-bold text-gray-900 dark:text-white mb-4">
              Dashboard Coming Soon
            </h1>
            <p className="text-xl text-gray-600 dark:text-gray-300 mb-8 max-w-2xl mx-auto">
              Your complete dashboard for managing your 3Numbers subscription, viewing daily numbers, 
              and adjusting settings will be available after authentication is implemented.
            </p>
            
            {/* Preview Cards */}
            <div className="grid md:grid-cols-3 gap-6 mt-12 max-w-4xl mx-auto">
              <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6">
                <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-2">
                  Daily Numbers
                </h3>
                <p className="text-gray-600 dark:text-gray-300 text-sm">
                  View your recent financial metrics and SMS delivery history
                </p>
              </div>
              <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6">
                <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-2">
                  Settings
                </h3>
                <p className="text-gray-600 dark:text-gray-300 text-sm">
                  Adjust your message time, phone number, and notification preferences
                </p>
              </div>
              <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6">
                <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-2">
                  Subscription
                </h3>
                <p className="text-gray-600 dark:text-gray-300 text-sm">
                  Manage your billing, upgrade plans, or cancel your subscription
                </p>
              </div>
            </div>

            <Link
              href="/"
              className="inline-flex items-center mt-8 text-indigo-600 hover:text-indigo-700 dark:text-indigo-400 dark:hover:text-indigo-300 font-medium"
            >
              ← Back to home
            </Link>
          </div>
        </div>
      </main>
    </div>
  );
}
