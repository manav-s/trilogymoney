import { Lock, ShieldCheck, EyeOff, Wifi, Signal, Battery } from "lucide-react";

export default function Home() {
  return (
    <div className="min-h-screen bg-white selection:bg-blue-100 selection:text-blue-900 overflow-x-hidden">
      {/* Navigation */}
      <nav className="fixed top-0 w-full z-50 bg-white/80 backdrop-blur-md border-b border-gray-100 transition-all duration-300">
        <div className="flex items-center justify-between p-6 lg:px-8 max-w-7xl mx-auto">
          <div className="flex items-center">
            <span className="text-xl font-bold text-gray-900 lowercase tracking-tight hover:opacity-80 transition-opacity cursor-pointer">
              trilogy
            </span>
          </div>
          <div className="flex items-center gap-6">
            <a href="/pricing" className="text-sm font-medium text-gray-600 lowercase hover:text-blue-600 transition-colors">
              pricing
            </a>
            <a href="/signin" className="text-sm font-medium text-gray-600 lowercase hover:text-blue-600 transition-colors">
              sign in
            </a>
            <a href="https://shorturl.at/KGbiL" className="hidden sm:block px-5 py-2.5 text-sm font-semibold rounded-full bg-gray-900 text-white hover:bg-gray-800 transition-all hover:scale-105 shadow-lg hover:shadow-xl">
              get started
            </a>
          </div>
        </div>
      </nav>

      {/* Hero Section */}
      <main className="relative pt-32 pb-16 sm:pt-40 sm:pb-24 overflow-hidden">
        {/* Background Gradients */}
        <div className="absolute top-0 left-1/2 -translate-x-1/2 w-full h-full max-w-7xl -z-10 pointer-events-none">
          <div className="absolute top-20 left-20 w-72 h-72 bg-blue-400/20 rounded-full blur-3xl animate-pulse mix-blend-multiply"></div>
          <div className="absolute top-40 right-20 w-96 h-96 bg-indigo-400/20 rounded-full blur-3xl animate-pulse mix-blend-multiply delay-100"></div>
          <div className="absolute -bottom-20 left-1/2 w-80 h-80 bg-purple-400/20 rounded-full blur-3xl animate-pulse mix-blend-multiply delay-200"></div>
        </div>

        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid lg:grid-cols-2 gap-12 lg:gap-20 items-center">
            {/* Left side - Content */}
            <div className="space-y-8 text-center lg:text-left animate-fade-in-up">
              <div className="inline-flex items-center px-3 py-1 rounded-full bg-blue-50 border border-blue-100 text-blue-600 text-xs font-medium uppercase tracking-wider mb-4">
                <span className="relative flex h-2 w-2 mr-2">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-blue-400 opacity-75"></span>
                  <span className="relative inline-flex rounded-full h-2 w-2 bg-blue-500"></span>
                </span>
                the only imessage native finance tracker
              </div>

              <h1 className="text-5xl sm:text-6xl lg:text-7xl font-bold tracking-tight text-gray-900 leading-[1.1]">
                your money&apos;s <br />
                <span className="text-[#007AFF]">personal assistant.</span>
              </h1>

              <p className="text-xl sm:text-2xl text-gray-600 leading-relaxed max-w-2xl mx-auto lg:mx-0">
                texts you via imessage like a friend. once a week, a quick money check-in.
              </p>

              <div className="flex flex-col sm:flex-row items-center justify-center lg:justify-start gap-4 pt-4">
                <a
                  href="https://shorturl.at/KGbiL"
                  className="px-10 py-4 text-lg font-semibold rounded-full bg-blue-600 text-white hover:bg-blue-700 transition-all shadow-lg hover:shadow-blue-500/30 hover:-translate-y-1"
                >
                  start now
                </a>
                <p className="text-sm text-gray-500">
                  cancel anytime • blue bubbles
                </p>
              </div>


            </div>

            {/* Right side - iPhone mockup */}
            <div className="relative flex justify-center lg:justify-end animate-float delay-300">
              <div className="relative z-10">
                {/* Glass Panel Behind */}
                <div className="absolute -inset-4 bg-gradient-to-tr from-blue-100 to-indigo-100 rounded-[3.5rem] blur-xl opacity-70"></div>
                
                {/* iPhone frame */}
                <div className="relative bg-black rounded-[3rem] p-3 shadow-2xl">
                  <div className="bg-white rounded-[2.5rem] overflow-hidden" style={{ width: "280px", height: "560px" }}>
                    {/* Status bar */}
                    <div className="flex items-center justify-between px-6 py-3 bg-white">
                      <span className="text-sm font-semibold text-gray-900">9:41</span>
                      <div className="flex items-center space-x-1">
                        <Signal className="w-3 h-3 text-gray-900" />
                        <Wifi className="w-3 h-3 text-gray-900" />
                        <Battery className="w-4 h-3 text-gray-900" />
                      </div>
                    </div>

                    {/* SMS content */}
                    <div className="px-4 py-6 bg-white h-full overflow-y-auto no-scrollbar">
                      <p className="text-xs text-gray-400 mb-2 text-center">
                        today 8:03 AM
                      </p>
                      {/* Trilogy's message (gray bubble, left-aligned) */}
                      <div className="bg-gray-200 rounded-3xl rounded-bl-sm p-4 shadow-md max-w-[240px] animate-fade-in-up delay-100">
                        <p className="text-gray-900 text-sm mb-2">
                          weekly summary: nov 10 → nov 16
                        </p>
                        <p className="text-gray-900 text-sm mb-3">
                          you spent $450 this week with amazon leading the way.
                        </p>
                        <div className="space-y-1.5 text-gray-900 text-sm mb-3">
                          <p>🛍️ general merchandise $315</p>
                          <p>💅 personal care $94</p>
                          <p>🚗 transportation $25</p>
                        </div>
                        <p className="text-gray-900 text-sm">
                          balances: td bank $3,589
                        </p>
                      </div>

                      {/* Second message bubble (gray, left-aligned) */}
                      <div className="bg-gray-200 rounded-3xl rounded-bl-sm p-4 shadow-md max-w-[240px] mt-2 animate-fade-in-up delay-200">
                        <p className="text-gray-900 text-sm">
                          doordash is lowkey eating your wallet rn 😭
                        </p>
                      </div>

                      {/* User's response (iMessage blue bubble, right-aligned) */}
                      <div className="flex justify-end mt-3 animate-fade-in-up delay-300">
                        <div className="bg-[#007AFF] rounded-3xl rounded-br-sm p-4 shadow-md max-w-[200px]">
                          <p className="text-white text-sm">
                            ok fine
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
      <section className="py-24 sm:py-32 bg-gray-50 relative overflow-hidden">
        <div className="absolute top-0 left-0 w-full h-full bg-[radial-gradient(#e5e7eb_1px,transparent_1px)] [background-size:16px_16px] [mask-image:radial-gradient(ellipse_50%_50%_at_50%_50%,#000_70%,transparent_100%)] opacity-50"></div>
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 text-center space-y-12 relative z-10">
          <div className="space-y-6">
            <p className="text-xl sm:text-2xl text-gray-600 font-medium">
              most finance apps are exhausting.
            </p>
            <p className="text-lg text-gray-500 max-w-2xl mx-auto">
              they want you to build budgets, track every category, and stare at charts until your eyes glaze over.
            </p>
          </div>
          
          <div className="glass-panel rounded-3xl p-8 sm:p-12 transform hover:scale-[1.02] transition-transform duration-500">
            <h2 className="text-4xl sm:text-5xl font-bold text-gray-900 mb-6">
              trilogy is <span className="text-blue-600">different.</span>
            </h2>
            <p className="text-xl sm:text-2xl text-gray-700 leading-relaxed">
              once a week, you get an imessage with what actually matters.
            </p>
            <div className="mt-8 pt-8 border-t border-gray-100 grid sm:grid-cols-2 gap-8">
              <div className="space-y-2">
                <div className="text-3xl">🚫</div>
                <p className="font-medium text-gray-900">no app to open</p>
              </div>
              <div className="space-y-2">
                <div className="text-3xl">🧘</div>
                <p className="font-medium text-gray-900">just awareness</p>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* How it works */}
      <section className="py-24 sm:py-32 bg-white relative">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
          <h2 className="text-4xl sm:text-5xl font-bold text-center text-gray-900 mb-20">
            how it works
          </h2>

          <div className="grid sm:grid-cols-3 gap-12 relative">
            {/* Connecting Line (Desktop) */}
            <div className="hidden sm:block absolute top-8 left-[16%] right-[16%] h-0.5 bg-gradient-to-r from-blue-200 via-blue-400 to-blue-200 -z-10"></div>

            {/* Step 1 */}
            <div className="text-center space-y-6 group">
              <div className="w-16 h-16 mx-auto rounded-2xl bg-white border-2 border-blue-100 text-blue-600 flex items-center justify-center text-2xl font-bold shadow-lg group-hover:scale-110 group-hover:border-blue-500 transition-all duration-300 bg-blue-50">
                1
              </div>
              <h3 className="text-2xl font-bold text-gray-900 group-hover:text-blue-600 transition-colors">
                connect your bank
              </h3>
              <p className="text-lg text-gray-600 leading-relaxed">
                secure plaid integration. 60-second setup, one time.
              </p>
            </div>

            {/* Step 2 */}
            <div className="text-center space-y-6 group">
              <div className="w-16 h-16 mx-auto rounded-2xl bg-blue-600 text-white flex items-center justify-center text-2xl font-bold shadow-lg shadow-blue-200 group-hover:scale-110 transition-all duration-300 ring-4 ring-blue-50">
                2
              </div>
              <h3 className="text-2xl font-bold text-gray-900 group-hover:text-blue-600 transition-colors">
                get weekly updates
              </h3>
              <p className="text-lg text-gray-600 leading-relaxed">
                every week, an imessage with your balance, spending, and insights.
              </p>
            </div>

            {/* Step 3 */}
            <div className="text-center space-y-6 group">
              <div className="w-16 h-16 mx-auto rounded-2xl bg-white border-2 border-blue-100 text-blue-600 flex items-center justify-center text-2xl font-bold shadow-lg group-hover:scale-110 group-hover:border-blue-500 transition-all duration-300 bg-blue-50">
                3
              </div>
              <h3 className="text-2xl font-bold text-gray-900 group-hover:text-blue-600 transition-colors">
                stay aware
              </h3>
              <p className="text-lg text-gray-600 leading-relaxed">
                a simple check-in that keeps you on top of your money, stress-free.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* Why this works Section */}
      <section className="py-24 sm:py-32 bg-gray-900 relative overflow-hidden">
        {/* Subtle background glow */}
        <div className="absolute top-0 left-1/2 -translate-x-1/2 w-full h-full max-w-4xl opacity-20 pointer-events-none">
          <div className="absolute top-1/4 left-1/4 w-96 h-96 bg-blue-500/30 rounded-full blur-3xl mix-blend-screen animate-float delay-100"></div>
          <div className="absolute bottom-1/4 right-1/4 w-96 h-96 bg-indigo-500/30 rounded-full blur-3xl mix-blend-screen animate-float delay-300"></div>
        </div>

        <div className="max-w-3xl mx-auto px-6 lg:px-8 relative z-10 text-center">
          <h2 className="text-3xl sm:text-4xl font-bold text-white mb-12 lowercase tracking-tight">
            why this works
          </h2>

          <div className="space-y-12">
            <div className="space-y-6">
              <p className="text-xl sm:text-2xl text-gray-300 font-light leading-relaxed lowercase">
                you don&apos;t need another app telling you what to do with your money.
              </p>
              <p className="text-3xl sm:text-4xl font-semibold text-white leading-tight lowercase">
                you just need to know <br className="hidden sm:block" />
                <span className="text-transparent bg-clip-text bg-gradient-to-r from-blue-400 to-indigo-400">
                  where you&apos;re at.
                </span>
              </p>
            </div>

            <div className="space-y-8 pt-8 border-t border-white/10">
              <p className="text-lg text-gray-400 leading-relaxed max-w-2xl mx-auto lowercase">
                seeing the numbers once a week. noticing patterns. staying intentional. that alone can ease the anxiety of &quot;i don&apos;t even know what&apos;s going on with my money.&quot;
              </p>
              
              <div className="inline-block px-6 py-3 rounded-full bg-white/5 border border-white/10 backdrop-blur-sm">
                <p className="text-sm text-gray-300 lowercase">
                  no judgment. no lectures. no $200/month financial advisor.
                </p>
              </div>

              <p className="text-lg text-white font-medium lowercase">
                trilogy gives you clarity. what you do with it is totally up to you.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* Security Section */}
      <section className="py-24 sm:py-32 bg-white relative overflow-hidden">
        <div className="max-w-7xl mx-auto px-6 lg:px-8 relative z-10">
          <div className="text-center max-w-3xl mx-auto mb-16">
            <h2 className="text-3xl sm:text-4xl font-bold text-gray-900 mb-6 lowercase">
              uncompromising security.
            </h2>
            <p className="text-lg text-gray-600 lowercase">
              your financial data is protected by industry-leading encryption and security standards. built by microsoft security engineers.
            </p>
            
            {/* Trust badges */}
            <div className="flex flex-wrap items-center justify-center gap-6 mt-8">
              <div className="flex items-center gap-2 px-4 py-2 bg-gray-50 rounded-lg border border-gray-200">
                <ShieldCheck className="w-5 h-5 text-blue-600" />
                <span className="text-sm font-semibold text-gray-700">SOC 2 Compliant</span>
              </div>
              <div className="flex items-center gap-2 px-4 py-2 bg-gray-50 rounded-lg border border-gray-200">
                <Lock className="w-5 h-5 text-blue-600" />
                <span className="text-sm font-semibold text-gray-700">GDPR Compliant</span>
              </div>
            </div>
          </div>

          <div className="grid md:grid-cols-4 gap-8 lg:gap-12">
            {/* Feature 1 */}
            <div className="flex flex-col items-center text-center p-6 rounded-2xl bg-gray-50 border border-gray-100 shadow-sm hover:shadow-md transition-shadow">
              <div className="w-12 h-12 bg-blue-100 rounded-xl flex items-center justify-center mb-6 text-blue-600">
                <Lock className="w-6 h-6" />
              </div>
              <h3 className="text-xl font-semibold text-gray-900 mb-3 lowercase">
                bank-grade encryption
              </h3>
              <p className="text-gray-600 lowercase">
                we utilize aes-256 encryption for all data at rest and in transit.
              </p>
            </div>

            {/* Feature 2 */}
            <div className="flex flex-col items-center text-center p-6 rounded-2xl bg-gray-50 border border-gray-100 shadow-sm hover:shadow-md transition-shadow">
              <div className="w-12 h-12 bg-blue-100 rounded-xl flex items-center justify-center mb-6 text-blue-600">
                <ShieldCheck className="w-6 h-6" />
              </div>
              <h3 className="text-xl font-semibold text-gray-900 mb-3 lowercase">
                trusted infrastructure
              </h3>
              <p className="text-gray-600 lowercase">
                we partner with plaid to securely connect your accounts without ever seeing your credentials.
              </p>
            </div>

            {/* Feature 3 */}
            <div className="flex flex-col items-center text-center p-6 rounded-2xl bg-gray-50 border border-gray-100 shadow-sm hover:shadow-md transition-shadow">
              <div className="w-12 h-12 bg-blue-100 rounded-xl flex items-center justify-center mb-6 text-blue-600">
                <EyeOff className="w-6 h-6" />
              </div>
              <h3 className="text-xl font-semibold text-gray-900 mb-3 lowercase">
                privacy first
              </h3>
              <p className="text-gray-600 lowercase">
                we do not sell your personal data. your financial privacy is our core commitment.
              </p>
            </div>

            {/* Feature 4 - NEW */}
            <div className="flex flex-col items-center text-center p-6 rounded-2xl bg-gray-50 border border-gray-100 shadow-sm hover:shadow-md transition-shadow">
              <div className="w-12 h-12 bg-blue-100 rounded-xl flex items-center justify-center mb-6 text-blue-600">
                <Lock className="w-6 h-6" />
              </div>
              <h3 className="text-xl font-semibold text-gray-900 mb-3 lowercase">
                end-to-end encrypted
              </h3>
              <p className="text-gray-600 lowercase">
                all messages sent via imessage are end-to-end encrypted by apple.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* Final CTA */}
      <section className="py-24 sm:py-32 bg-white relative overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-b from-white to-blue-50/50"></div>
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 text-center space-y-10 relative z-10">
          <h2 className="text-5xl sm:text-6xl font-bold text-gray-900 tracking-tight">
            ready to stay aware?
          </h2>

          <div className="flex flex-col items-center gap-6">
            <a
              href="https://shorturl.at/KGbiL"
              className="relative inline-flex items-center px-12 py-6 text-xl font-bold rounded-full bg-blue-600 text-white hover:bg-blue-700 transition-all shadow-xl hover:shadow-2xl hover:-translate-y-1 overflow-hidden group"
            >
              <span className="relative z-10">start now</span>
              <div className="absolute inset-0 bg-gradient-to-r from-blue-600 via-blue-500 to-blue-600 opacity-0 group-hover:opacity-100 transition-opacity duration-300"></div>
              <div className="absolute inset-0 bg-[url('https://grainy-gradients.vercel.app/noise.svg')] opacity-20"></div>
            </a>

            <p className="text-sm text-gray-500 flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-green-500 animate-pulse"></span>
              we&apos;ll open your messages app — just hit send.
            </p>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t border-gray-100 bg-white">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
          <div className="flex flex-col sm:flex-row items-center justify-between space-y-4 sm:space-y-0">
            <span className="text-xl font-bold text-gray-900 lowercase tracking-tight">
              trilogy
            </span>
            <div className="flex items-center space-x-8 text-sm font-medium text-gray-500">
              <a href="/pricing" className="hover:text-blue-600 transition-colors">
                pricing
              </a>
              <a href="/privacy" className="hover:text-blue-600 transition-colors">
                privacy
              </a>
              <a href="/signin" className="hover:text-blue-600 transition-colors">
                sign in
              </a>
            </div>
            <p className="text-sm text-gray-400">© 2025 trilogy</p>
          </div>
        </div>
      </footer>
    </div>
  );
}
