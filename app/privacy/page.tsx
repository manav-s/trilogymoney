import Link from "next/link";

export default function PrivacyPage() {
  return (
    <div className="min-h-screen bg-white">
      {/* Navigation */}
      <nav className="flex items-center justify-between p-6 lg:px-8 max-w-7xl mx-auto">
        <div className="flex items-center">
          <Link href="/" className="text-xl font-bold text-gray-900 lowercase">
            trilogy
          </Link>
        </div>
      </nav>

      {/* Privacy Policy Content */}
      <main className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        <h1 className="text-4xl font-bold text-gray-900 mb-8 lowercase">privacy policy</h1>
        
        <div className="prose prose-lg max-w-none text-gray-600">
          <p className="text-sm text-gray-500 mb-8">
            Last Updated: October 14, 2025 | Effective Date: October 14, 2025
          </p>

          <section className="mb-12">
            <h2 className="text-2xl font-bold text-gray-900 mb-4 lowercase">our promise</h2>
            <p className="mb-4">
              we minimize what we keep and encrypt the rest. we never store your bank credentials, and we only
              retain the data needed to deliver your weekly money updates and operate the service safely.
            </p>
            <p>
              this policy explains what we collect, how we protect it, what we share, and your rights.
            </p>
          </section>

          <section className="mb-12">
            <h2 className="text-2xl font-bold text-gray-900 mb-4 lowercase">what we collect & why</h2>
            
            <div className="mb-6">
              <h3 className="text-xl font-semibold text-gray-800 mb-2 lowercase">to set up your account</h3>
              <ul className="list-disc pl-6 space-y-2">
                <li><strong>phone number</strong> - to send you daily texts and verify your identity</li>
                <li><strong>name</strong> - to personalize your messages</li>
                <li><strong>timezone & preferred time</strong> - to send texts when you want them</li>
              </ul>
            </div>

            <div className="mb-6">
              <h3 className="text-xl font-semibold text-gray-800 mb-2 lowercase">to connect your bank</h3>
              <ul className="list-disc pl-6 space-y-2">
                <li><strong>encrypted plaid access token</strong> - used to securely fetch account data</li>
                <li><strong>institution & account metadata</strong> - name, mask, type/subtype, currency</li>
                <li><strong>balances/snapshots</strong> - minimal fields required to generate your weekly summary</li>
              </ul>
              <p className="mt-2 text-sm italic">
                note: we never store your bank login credentials — those go directly to plaid.
              </p>
            </div>

            <div className="mb-6">
              <h3 className="text-xl font-semibold text-gray-800 mb-2 lowercase">conversation history (we store this)</h3>
              <ul className="list-disc pl-6 space-y-2">
                <li><strong>message content</strong> - encrypted at rest</li>
                <li><strong>metadata</strong> - direction, status, provider, timestamps (not encrypted)</li>
              </ul>
              <p className="mt-2 text-sm italic">
                most messages auto‑expire after 60 days; some onboarding messages may be kept up to 90 days.
              </p>
            </div>
          </section>

          <section className="mb-12">
            <h2 className="text-2xl font-bold text-gray-900 mb-4 lowercase">how we protect your data</h2>
            
            <div className="space-y-4">
              <div>
                <h3 className="text-lg font-semibold text-gray-800 mb-1 lowercase">encryption everywhere</h3>
                <p>all sensitive data is encrypted using AES-256-GCM encryption, both in transit and at rest</p>
              </div>
              
              <div>
                <h3 className="text-lg font-semibold text-gray-800 mb-1 lowercase">secure infrastructure</h3>
                <p>we use SOC 2 certified providers: vercel for hosting and neon for database</p>
              </div>
              
              <div>
                <h3 className="text-lg font-semibold text-gray-800 mb-1 lowercase">access tokens</h3>
                <p>your plaid access token is encrypted and only decrypted when fetching your weekly numbers</p>
              </div>

              <div>
                <h3 className="text-lg font-semibold text-gray-800 mb-1 lowercase">no sensitive logs</h3>
                <p>we do not log decrypted financial data, tokens, or message content</p>
              </div>
            </div>
          </section>

          <section className="mb-12">
            <h2 className="text-2xl font-bold text-gray-900 mb-4 lowercase">who we share data with</h2>
            <p className="mb-4">we only share your data with services essential to trilogy:</p>
            
            <div className="space-y-4">
              <div className="border-l-4 border-indigo-500 pl-4">
                <h3 className="font-semibold text-gray-800 lowercase">plaid</h3>
                <p className="text-sm">connects to your bank securely. we share your encrypted access token to fetch data.</p>
              </div>
              
              <div className="border-l-4 border-indigo-500 pl-4">
                <h3 className="font-semibold text-gray-800 lowercase">blooio</h3>
                <p className="text-sm">delivers your texts. we share your phone number and message content.</p>
              </div>
              
              <div className="border-l-4 border-indigo-500 pl-4">
                <h3 className="font-semibold text-gray-800 lowercase">AI providers (when you chat)</h3>
                <p className="text-sm">not in use today. if enabled, we would share your question and real‑time calculations (not stored data) to generate responses.</p>
              </div>

              <div className="border-l-4 border-indigo-500 pl-4">
                <h3 className="font-semibold text-gray-800 lowercase">stripe</h3>
                <p className="text-sm">payments and subscription management.</p>
              </div>

              <div className="border-l-4 border-indigo-500 pl-4">
                <h3 className="font-semibold text-gray-800 lowercase">hosting & database</h3>
                <p className="text-sm">vercel (app hosting) and neon (database) as processors to run the service.</p>
              </div>
            </div>
            
            <p className="mt-4 font-semibold">we never sell your data. period.</p>
          </section>

          <section className="mb-12">
            <h2 className="text-2xl font-bold text-gray-900 mb-4 lowercase">your rights & controls</h2>
            <p className="mb-4">you&apos;re in control of your data:</p>
            
            <ul className="space-y-3">
              <li className="flex items-start">
                <span className="text-indigo-600 mr-2">→</span>
                <div>
                  <strong>pause texts</strong> - temporarily disable daily messages anytime
                </div>
              </li>
              <li className="flex items-start">
                <span className="text-indigo-600 mr-2">→</span>
                <div>
                  <strong>disconnect bank</strong> - instantly revoke our access to your bank data
                </div>
              </li>
              <li className="flex items-start">
                <span className="text-indigo-600 mr-2">→</span>
                <div>
                  <strong>delete account</strong> - remove all your data from our systems
                </div>
              </li>
              <li className="flex items-start">
                <span className="text-indigo-600 mr-2">→</span>
                <div>
                  <strong>export data</strong> - download everything we have about you
                </div>
              </li>
              <li className="flex items-start">
                <span className="text-indigo-600 mr-2">→</span>
                <div>
                  <strong>update info</strong> - change your preferences, timezone, or name
                </div>
              </li>
            </ul>

            <p className="mt-4 text-sm">
              under CCPA and GDPR, you have additional rights including the right to access, 
              correct, and delete your personal information. contact us to exercise these rights.
            </p>
          </section>

          <section className="mb-12">
            <h2 className="text-2xl font-bold text-gray-900 mb-4 lowercase">data retention</h2>
            <ul className="space-y-2">
              <li><strong>profile data</strong> - kept until you delete your account</li>
              <li><strong>conversation history</strong> - automatically deleted after 60 days</li>
              <li><strong>plaid access token</strong> - kept until you disconnect or delete account</li>
              <li><strong>security logs</strong> - retained for 30 days</li>
              <li><strong>deleted account data</strong> - permanently removed within 30 days</li>
            </ul>
          </section>

          <section className="mb-12">
            <h2 className="text-2xl font-bold text-gray-900 mb-4 lowercase">if something goes wrong</h2>
            <p className="mb-4">
              in the unlikely event of a data breach, we will:
            </p>
            <ul className="list-disc pl-6 space-y-2">
              <li>notify affected users within 72 hours</li>
              <li>explain what happened and what data was affected</li>
              <li>provide steps you should take</li>
              <li>work with authorities as required by law</li>
            </ul>
          </section>

          <section className="mb-12">
            <h2 className="text-2xl font-bold text-gray-900 mb-4 lowercase">compliance</h2>
            <p className="mb-4">we comply with:</p>
            <ul className="list-disc pl-6 space-y-2">
              <li><strong>GLBA</strong> - gramm-leach-bliley act (financial privacy)</li>
              <li><strong>CCPA</strong> - california consumer privacy act</li>
              <li><strong>GDPR</strong> - general data protection regulation (if applicable)</li>
              <li><strong>state privacy laws</strong> - virginia CDPA and others as applicable</li>
            </ul>
          </section>

          <section className="mb-12">
            <h2 className="text-2xl font-bold text-gray-900 mb-4 lowercase">changes to this policy</h2>
            <p>
              we&apos;ll notify you of any significant changes to this privacy policy by email and update the
              &quot;last updated&quot; date at the top. continued use of trilogy after changes means you accept the
              updated policy.
            </p>
          </section>

          <section className="mb-12">
            <h2 className="text-2xl font-bold text-gray-900 mb-4 lowercase">contact us</h2>
            <p className="mb-4">
              questions about privacy? concerns about your data? just want to chat?
            </p>
            <p>
              <strong>email:</strong> <a href="mailto:manav-s@outlook.com" className="text-indigo-600 hover:text-indigo-700">manav-s@outlook.com</a>
            </p>
          </section>

          <div className="mt-16 p-6 bg-gray-50 rounded-lg">
            <p className="text-sm text-gray-600 text-center">
              trilogy is committed to protecting your privacy and being transparent about our practices. 
              this policy was written in plain english because we believe you should understand 
              exactly how we handle your data.
            </p>
          </div>
        </div>
      </main>

      {/* Footer */}
      <footer className="border-t border-gray-200 mt-24">
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
