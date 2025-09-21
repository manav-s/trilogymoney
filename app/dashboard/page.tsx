import Link from "next/link";
import { UserButton } from "@clerk/nextjs";
import { auth } from "@clerk/nextjs/server";
import { redirect } from "next/navigation";
import { getOrCreateUser, userNeedsOnboarding } from "@/lib/user-utils";

export default async function DashboardPage() {
  const { userId } = await auth();
  
  if (!userId) {
    redirect("/signin");
  }

  // Get or create user in database
  const user = await getOrCreateUser();
  
  if (!user) {
    // If user creation failed, show error page instead of redirecting to signin
    return (
      <div className="min-h-screen bg-gray-50 dark:bg-gray-900 flex items-center justify-center">
        <div className="max-w-md w-full space-y-6 text-center">
          <div className="w-16 h-16 bg-red-100 dark:bg-red-900 rounded-full flex items-center justify-center mx-auto">
            <span className="text-red-600 dark:text-red-400 text-2xl">⚠️</span>
          </div>
          <h2 className="text-2xl font-bold text-gray-900 dark:text-white">
            Account Setup Error
          </h2>
          <p className="text-gray-600 dark:text-gray-400">
            We're having trouble setting up your account. Please try signing out and signing back in.
          </p>
          <div className="space-y-3">
            <form action="/api/sync-user" method="POST">
              <button 
                type="submit"
                className="w-full bg-indigo-600 text-white py-2 px-4 rounded-lg hover:bg-indigo-700"
              >
                Try Account Sync
              </button>
            </form>
            <Link
              href="/"
              className="block w-full bg-gray-200 dark:bg-gray-700 text-gray-800 dark:text-gray-200 py-2 px-4 rounded-lg hover:bg-gray-300 dark:hover:bg-gray-600"
            >
              Back to Home
            </Link>
          </div>
        </div>
      </div>
    );
  }

  // Check if user needs onboarding
  if (userNeedsOnboarding(user)) {
    redirect("/onboarding");
  }

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
              <span className="text-gray-700 dark:text-gray-300">
                Welcome back, {user.name}!
              </span>
              <UserButton afterSignOutUrl="/" />
            </div>
          </div>
        </div>
      </nav>

      <main className="max-w-7xl mx-auto py-6 sm:px-6 lg:px-8">
        <div className="px-4 py-6 sm:px-0">
          {/* User Status Banner */}
          {userNeedsOnboarding(user) && (
            <div className="bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800 rounded-lg p-4 mb-6">
              <div className="flex">
                <div className="flex-shrink-0">
                  <span className="text-yellow-400 text-xl">⚠️</span>
                </div>
                <div className="ml-3">
                  <h3 className="text-sm font-medium text-yellow-800 dark:text-yellow-200">
                    Complete Your Setup
                  </h3>
                  <p className="text-sm text-yellow-700 dark:text-yellow-300 mt-1">
                    Please complete your profile to start receiving daily financial updates.
                  </p>
                  <div className="mt-2">
                    <Link
                      href="/onboarding"
                      className="bg-yellow-100 dark:bg-yellow-800 text-yellow-800 dark:text-yellow-200 px-3 py-1 rounded text-sm font-medium hover:bg-yellow-200 dark:hover:bg-yellow-700"
                    >
                      Complete Setup →
                    </Link>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* User Info Cards */}
          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6 mb-8">
            {/* Profile Card */}
            <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6">
              <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
                Profile
              </h3>
                     <div className="space-y-2 text-sm">
                       <p><span className="font-medium">Name:</span> {user.name}</p>
                       <p><span className="font-medium">Email:</span> {user.email}</p>
                       <p><span className="font-medium">Phone:</span> {user.phone || 'Not set'}</p>
                       <p><span className="font-medium">Timezone:</span> {user.timezone}</p>
                     </div>
            </div>

            {/* Settings Card */}
            <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6">
              <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
                Message Settings
              </h3>
              <div className="space-y-2 text-sm">
                <p><span className="font-medium">Delivery Time:</span> {user.messageTime}:00</p>
                <p><span className="font-medium">Messages:</span> {user.messageEnabled ? 'Enabled' : 'Disabled'}</p>
                <p><span className="font-medium">Verified:</span> {user.isVerified ? '✅ Yes' : '❌ No'}</p>
              </div>
              <button className="mt-4 bg-indigo-600 text-white px-4 py-2 rounded text-sm hover:bg-indigo-700">
                Update Settings
              </button>
            </div>

            {/* Subscription Card */}
            <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6">
              <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
                Subscription
              </h3>
              <div className="text-center py-8">
                <span className="text-2xl">💳</span>
                <p className="text-sm text-gray-600 dark:text-gray-400 mt-2">
                  No active subscription
                </p>
                <button className="mt-4 bg-green-600 text-white px-4 py-2 rounded text-sm hover:bg-green-700">
                  Start Trial
                </button>
              </div>
            </div>
          </div>

          {/* Recent Activity */}
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6">
            <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
              Recent Activity
            </h3>
            <div className="text-center py-8">
              <span className="text-3xl">📊</span>
              <p className="text-gray-600 dark:text-gray-400 mt-2">
                No daily numbers yet. Complete your setup to start receiving financial updates!
              </p>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}
