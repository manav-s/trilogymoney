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
    redirect("/signin");
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
                <p><span className="font-medium">City:</span> {user.city || 'Not set'}</p>
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
