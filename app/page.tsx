import Link from "next/link";

export default function Home() {
  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 dark:from-gray-900 dark:to-gray-800">
      {/* Navigation */}
      <nav className="flex items-center justify-between p-6 lg:px-8">
        <div className="flex items-center">
          <span className="text-2xl font-bold text-indigo-600 dark:text-indigo-400">
            3Numbers
          </span>
        </div>
        <div className="flex items-center space-x-4">
          <Link 
            href="/signin" 
            className="text-gray-700 dark:text-gray-300 hover:text-indigo-600 dark:hover:text-indigo-400 font-medium"
          >
            Sign In
          </Link>
          <Link
            href="/signup"
            className="bg-indigo-600 text-white px-4 py-2 rounded-lg hover:bg-indigo-700 transition-colors font-medium"
          >
            Get Started
          </Link>
        </div>
      </nav>

      {/* Hero Section */}
      <main className="max-w-7xl mx-auto px-6 lg:px-8">
        <div className="text-center py-20 lg:py-32">
          <h1 className="text-4xl md:text-6xl font-bold text-gray-900 dark:text-white mb-6">
            Your Daily Financial
            <span className="text-indigo-600 dark:text-indigo-400"> 3Numbers</span>
          </h1>
          <p className="text-xl md:text-2xl text-gray-600 dark:text-gray-300 mb-8 max-w-3xl mx-auto">
            Get your 3 key financial metrics via SMS every day: bank balance, yesterday's spending, and this week's spending.
          </p>
          <p className="text-lg text-gray-500 dark:text-gray-400 mb-12">
            Simple financial awareness made effortless. No apps to check, no dashboards to open.
          </p>
          
          <div className="flex flex-col sm:flex-row gap-4 justify-center items-center">
            <Link
              href="/signup"
              className="bg-indigo-600 text-white px-8 py-4 rounded-lg hover:bg-indigo-700 transition-colors font-semibold text-lg min-w-[200px]"
            >
              Start Free Trial
            </Link>
            <p className="text-sm text-gray-500 dark:text-gray-400">
              3-day free trial • $10/month after
            </p>
          </div>
        </div>

        {/* SMS Preview */}
        <div className="flex justify-center mb-20">
          <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-xl p-8 max-w-sm">
            <div className="text-center mb-4">
              <div className="w-12 h-12 bg-green-100 dark:bg-green-900 rounded-full flex items-center justify-center mx-auto mb-2">
                <span className="text-green-600 dark:text-green-400 text-xl">📱</span>
              </div>
              <p className="text-sm text-gray-500 dark:text-gray-400">Daily SMS at 9:00 AM</p>
            </div>
            <div className="bg-gray-50 dark:bg-gray-700 rounded-lg p-4 font-mono text-sm">
              <p className="text-gray-800 dark:text-gray-200 mb-2">Your 3Numbers for Dec 15:</p>
              <p className="text-gray-800 dark:text-gray-200">💰 Balance: $2,847.32</p>
              <p className="text-gray-800 dark:text-gray-200">📉 Yesterday: $67.45</p>
              <p className="text-gray-800 dark:text-gray-200">📊 This week: $284.12</p>
              <p className="text-gray-500 dark:text-gray-400 text-xs mt-2">Reply STOP to unsubscribe</p>
            </div>
          </div>
        </div>

        {/* Features */}
        <div className="grid md:grid-cols-3 gap-8 mb-20">
          <div className="text-center">
            <div className="w-16 h-16 bg-indigo-100 dark:bg-indigo-900 rounded-full flex items-center justify-center mx-auto mb-4">
              <span className="text-indigo-600 dark:text-indigo-400 text-2xl">🏦</span>
            </div>
            <h3 className="text-xl font-semibold text-gray-900 dark:text-white mb-2">
              Bank Connected
            </h3>
            <p className="text-gray-600 dark:text-gray-300">
              Securely connect your bank account to get real-time balance and spending data.
            </p>
          </div>
          <div className="text-center">
            <div className="w-16 h-16 bg-indigo-100 dark:bg-indigo-900 rounded-full flex items-center justify-center mx-auto mb-4">
              <span className="text-indigo-600 dark:text-indigo-400 text-2xl">📱</span>
            </div>
            <h3 className="text-xl font-semibold text-gray-900 dark:text-white mb-2">
              Daily SMS
            </h3>
            <p className="text-gray-600 dark:text-gray-300">
              Receive your numbers every morning at your preferred time. No apps to open.
            </p>
          </div>
          <div className="text-center">
            <div className="w-16 h-16 bg-indigo-100 dark:bg-indigo-900 rounded-full flex items-center justify-center mx-auto mb-4">
              <span className="text-indigo-600 dark:text-indigo-400 text-2xl">🎯</span>
            </div>
            <h3 className="text-xl font-semibold text-gray-900 dark:text-white mb-2">
              Simple & Focused
            </h3>
            <p className="text-gray-600 dark:text-gray-300">
              Just 3 numbers that matter most. No complex dashboards or overwhelming data.
            </p>
          </div>
        </div>

        {/* Pricing */}
        <div className="text-center mb-20">
          <h2 className="text-3xl font-bold text-gray-900 dark:text-white mb-8">
            Simple, Transparent Pricing
          </h2>
          <div className="max-w-md mx-auto">
            <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-xl p-8">
              <div className="mb-6">
                <p className="text-4xl font-bold text-gray-900 dark:text-white">$10</p>
                <p className="text-gray-500 dark:text-gray-400">/month</p>
                <p className="text-sm text-indigo-600 dark:text-indigo-400 mt-2">
                  or $100/year (save $20)
                </p>
              </div>
              <ul className="space-y-3 mb-8 text-left">
                <li className="flex items-center text-gray-600 dark:text-gray-300">
                  <span className="text-green-500 mr-2">✓</span>
                  Daily SMS with your 3 numbers
                </li>
                <li className="flex items-center text-gray-600 dark:text-gray-300">
                  <span className="text-green-500 mr-2">✓</span>
                  Bank account integration
                </li>
                <li className="flex items-center text-gray-600 dark:text-gray-300">
                  <span className="text-green-500 mr-2">✓</span>
                  Custom delivery time
                </li>
                <li className="flex items-center text-gray-600 dark:text-gray-300">
                  <span className="text-green-500 mr-2">✓</span>
                  3-day free trial
                </li>
              </ul>
              <Link
                href="/signup"
                className="block w-full bg-indigo-600 text-white py-3 rounded-lg hover:bg-indigo-700 transition-colors font-semibold"
              >
                Start Free Trial
              </Link>
            </div>
          </div>
        </div>
      </main>

      {/* Footer */}
      <footer className="border-t border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800">
        <div className="max-w-7xl mx-auto px-6 lg:px-8 py-8">
          <div className="text-center">
            <span className="text-2xl font-bold text-indigo-600 dark:text-indigo-400">
              3Numbers
            </span>
            <p className="text-gray-500 dark:text-gray-400 mt-2">
              Daily financial awareness made simple.
            </p>
          </div>
        </div>
      </footer>
    </div>
  );
}
