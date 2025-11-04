"use client";

export default function ContactPage() {
  return (
    <div className="min-h-screen bg-white">
      <div className="max-w-2xl mx-auto px-4 py-16">
        <h1 className="text-4xl font-bold text-gray-900 mb-6 lowercase">add trilogy to contacts</h1>
        <p className="text-gray-600 lowercase mb-8">save our number so future messages don’t get lost</p>

        <a
          href="/trilogy.vcf"
          className="px-8 py-4 rounded-full bg-indigo-600 text-white lowercase hover:bg-indigo-700"
        >
          add contact
        </a>

        <p className="text-gray-500 text-sm lowercase mt-4">on iphone, tapping will open the contact card to save</p>

        <div className="mt-10">
          <a href="/dashboard" className="px-8 py-4 rounded-full bg-gray-900 text-white lowercase">continue</a>
        </div>
      </div>
    </div>
  );
}


