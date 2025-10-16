export default function Home() {
  return (
    <div className="min-h-screen bg-white">
      {/* Navigation */}
      <nav className="flex items-center justify-between p-6 lg:px-8 max-w-7xl mx-auto">
        <div className="flex items-center">
          <span className="text-xl font-bold text-gray-900 lowercase">
            trilogy
          </span>
        </div>
      </nav>

      {/* Hero Section */}
      <main className="bg-gradient-to-br from-indigo-50 via-white to-purple-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-16 sm:py-24">
          <div className="grid lg:grid-cols-2 gap-12 lg:gap-16 items-center">
            {/* Left side - Content */}
            <div className="space-y-8">
              <div className="flex flex-wrap gap-3">
                <div className="inline-block px-4 py-2 bg-indigo-50 border border-indigo-100 rounded-full">
                  <span className="text-sm text-indigo-600 font-medium lowercase">
                    launching soon
                  </span>
                </div>
                <div className="inline-block px-4 py-2 bg-blue-50 border border-blue-200 rounded-full">
                  <span className="text-sm text-blue-600 font-medium lowercase">
                    💙 imessage native
                  </span>
                </div>
              </div>

              <h1 className="text-5xl sm:text-6xl lg:text-7xl font-bold tracking-tight text-gray-900 lowercase">
                your money&apos;s personal assistant.
              </h1>

              <p className="text-xl sm:text-2xl text-gray-600 lowercase">
                texts you via imessage like a friend. keeps you aware. will roast you sometimes.
              </p>

              <div className="space-y-4">
                <a
                  href="https://shorturl.at/KGbiL"
                  className="inline-flex items-center px-10 py-5 text-xl font-semibold rounded-full bg-indigo-600 text-white hover:bg-indigo-700 focus:ring-4 focus:ring-indigo-600/20 transition-all lowercase shadow-lg hover:shadow-xl hover:-translate-y-0.5"
                >
                  start now
                </a>

                <div className="text-sm text-gray-500 lowercase">
                  <p>cancel anytime • blue bubbles</p>
                </div>
              </div>
            </div>

            {/* Right side - iPhone mockup */}
            <div className="flex justify-center lg:justify-end">
              <div className="relative">
                {/* iPhone frame */}
                <div className="relative bg-black rounded-[3rem] p-3 shadow-2xl">
                  <div className="bg-white rounded-[2.5rem] overflow-hidden" style={{ width: "280px", height: "560px" }}>
                    {/* Status bar */}
                    <div className="flex items-center justify-between px-6 py-3 bg-white">
                      <span className="text-sm font-semibold text-gray-900">9:41</span>
                      <div className="flex items-center space-x-1">
                        <div className="w-4 h-4 border border-gray-900 rounded-sm"></div>
                      </div>
                    </div>

                    {/* SMS content */}
                    <div className="px-4 py-6 bg-white">
                      <p className="text-xs text-gray-400 mb-2 text-center">
                        today 8:03 AM
                      </p>
                      {/* Trilogy's message (blue bubble, left-aligned) */}
                      <div className="bg-blue-500 rounded-3xl rounded-tl-sm p-4 shadow-md max-w-[240px]">
                        <p className="text-white text-sm mb-3">
                          checking in on you 👀
                        </p>
                        <div className="space-y-2 text-white text-sm">
                          <p>💰 chase checking:</p>
                          <p className="ml-2">$2,547.83</p>
                          <p>💸 yesterday:</p>
                          <p className="ml-2">-$47.20</p>
                          <p>📊 this week:</p>
                          <p className="ml-2">-$312.45</p>
                        </div>
                        <p className="text-white text-sm mt-4">
                          maybe lay off the doordash today? 🤨
                        </p>
                      </div>
                      
                      {/* User's response (gray bubble, right-aligned) */}
                      <div className="flex justify-end mt-3">
                        <div className="bg-gray-200 rounded-3xl rounded-tr-sm p-4 shadow-md max-w-[240px]">
                          <p className="text-gray-900 text-sm">
                            ok fine 🙄
                          </p>
                        </div>
                      </div>
                    </div>
                  </div>
                  {/* iPhone notch */}
                  <div className="absolute top-6 left-1/2 transform -translate-x-1/2 bg-black rounded-full" style={{ width: "100px", height: "25px" }}></div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </main>

      {/* Problem statement */}
      <section className="py-16 sm:py-24 bg-gray-50">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 text-center space-y-8">
          <p className="text-xl sm:text-2xl text-gray-600 lowercase">
            most finance apps are exhausting.
          </p>
          <h2 className="text-4xl sm:text-5xl font-bold text-gray-900 lowercase">
            we built something different.
          </h2>
          <p className="text-xl sm:text-2xl text-gray-700 lowercase">
            every morning, you get an imessage. three numbers:
          </p>
        </div>
      </section>

      {/* Three numbers */}
      <section className="py-16 sm:py-24 bg-white">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid sm:grid-cols-3 gap-8">
            <div className="text-center p-8 bg-white border border-gray-200 rounded-2xl shadow-sm">
              <div className="text-5xl mb-4">💰</div>
              <p className="text-lg font-semibold text-gray-900 lowercase">
                your balance
              </p>
            </div>

            <div className="text-center p-8 bg-white border border-gray-200 rounded-2xl shadow-sm">
              <div className="text-5xl mb-4">💸</div>
              <p className="text-lg font-semibold text-gray-900 lowercase">
                yesterday
              </p>
            </div>

            <div className="text-center p-8 bg-white border border-gray-200 rounded-2xl shadow-sm">
              <div className="text-5xl mb-4">📊</div>
              <p className="text-lg font-semibold text-gray-900 lowercase">
                this week
              </p>
            </div>
          </div>

          <div className="text-center mt-12 space-y-4">
            <p className="text-xl text-gray-700 lowercase">
              no app to open. no charts to analyze.
            </p>
            <p className="text-2xl sm:text-3xl font-bold text-gray-900 lowercase">
              just awareness.
            </p>
          </div>
        </div>
      </section>

      {/* How it works */}
      <section className="py-16 sm:py-24 bg-gray-50">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
          <h2 className="text-4xl sm:text-5xl font-bold text-center text-gray-900 mb-16 lowercase">
            how it works
          </h2>

          <div className="grid sm:grid-cols-3 gap-12">
            {/* Step 1 */}
            <div className="text-center space-y-4">
              <div className="w-16 h-16 mx-auto rounded-2xl bg-indigo-600 text-white flex items-center justify-center text-2xl font-bold shadow-lg">
                1
              </div>
              <h3 className="text-2xl font-bold text-gray-900 lowercase">
                connect your bank
              </h3>
              <p className="text-lg text-gray-600 lowercase">
                secure plaid integration (one-time setup)
              </p>
            </div>

            {/* Step 2 */}
            <div className="text-center space-y-4">
              <div className="w-16 h-16 mx-auto rounded-2xl bg-purple-600 text-white flex items-center justify-center text-2xl font-bold shadow-lg">
                2
              </div>
              <h3 className="text-2xl font-bold text-gray-900 lowercase">
                choose your time
              </h3>
              <p className="text-lg text-gray-600 lowercase">
                get your 3 numbers when you want them
              </p>
            </div>

            {/* Step 3 */}
            <div className="text-center space-y-4">
              <div className="w-16 h-16 mx-auto rounded-2xl bg-blue-600 text-white flex items-center justify-center text-2xl font-bold shadow-lg">
                3
              </div>
              <h3 className="text-2xl font-bold text-gray-900 lowercase">
                stay aware
              </h3>
              <p className="text-lg text-gray-600 lowercase">
                daily imessage 💙 with what matters most
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* Why this works */}
      <section className="py-16 sm:py-24 bg-white">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
          <h2 className="text-4xl sm:text-5xl font-bold text-center text-gray-900 mb-12 lowercase">
            why this works
          </h2>

          <div className="space-y-6 text-center text-lg sm:text-xl text-gray-700 lowercase">
            <p>
              you don&apos;t need another app telling you what to do with your money.
            </p>
            <p className="text-2xl sm:text-3xl font-bold text-gray-900">
              you just need to know where you&apos;re at.
            </p>
            <p>
              sometimes that&apos;s all it takes. seeing the numbers. being aware. staying intentional.
            </p>
            <p>
              no judgment. no lectures. no $200/month financial advisor.
            </p>
            <p className="text-gray-500">
              what you do with that? totally up to you.
            </p>
          </div>
        </div>
      </section>

      {/* Final CTA */}
      <section className="py-16 sm:py-24 bg-gray-50">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 text-center space-y-8">
          <h2 className="text-4xl sm:text-5xl font-bold text-gray-900 lowercase">
            join the waitlist
          </h2>

          <a
            href="https://shorturl.at/KGbiL"
            className="inline-flex items-center px-10 py-5 text-xl font-semibold rounded-full bg-indigo-600 text-white hover:bg-indigo-700 focus:ring-4 focus:ring-indigo-600/20 transition-all lowercase shadow-lg hover:shadow-xl hover:-translate-y-0.5"
          >
            start now
          </a>

          <p className="text-sm text-gray-500 lowercase">
            we&apos;ll open your messages app. just hit send!
          </p>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t border-gray-200 bg-white">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
          <div className="flex flex-col sm:flex-row items-center justify-between space-y-4 sm:space-y-0">
            <span className="text-xl font-bold text-gray-900 lowercase">
              trilogy
            </span>
            <div className="flex items-center space-x-6 text-sm text-gray-600 lowercase">
              <a href="/privacy" className="hover:text-indigo-600 transition-colors">
                privacy
              </a>
            </div>
            <p className="text-sm text-gray-500 lowercase">© 2025 trilogy</p>
          </div>
        </div>
      </footer>
    </div>
  );
}
