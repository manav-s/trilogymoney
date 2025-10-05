"use client";

import { useState } from "react";

export default function TestSMSButton() {
  const [isLoading, setIsLoading] = useState(false);
  const [message, setMessage] = useState<{ type: 'success' | 'error', text: string } | null>(null);

  const handleSendTest = async () => {
    setIsLoading(true);
    setMessage(null);

    try {
      const response = await fetch('/api/sms/send-test', {
        method: 'POST',
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.message || data.error || 'Failed to send SMS');
      }

      setMessage({
        type: 'success',
        text: `✅ Test SMS sent successfully to ${data.phone}!`,
      });
    } catch (error: any) {
      console.error('Error sending test SMS:', error);
      setMessage({
        type: 'error',
        text: `❌ ${error.message}`,
      });
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="space-y-3">
      <button
        onClick={handleSendTest}
        disabled={isLoading}
        className="w-full bg-indigo-600 text-white py-2 px-4 rounded-lg hover:bg-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
      >
        {isLoading ? 'Sending...' : '📱 Send Test SMS'}
      </button>

      {message && (
        <div
          className={`p-3 rounded-lg text-sm ${
            message.type === 'success'
              ? 'bg-green-50 dark:bg-green-900/20 text-green-800 dark:text-green-200 border border-green-200 dark:border-green-800'
              : 'bg-red-50 dark:bg-red-900/20 text-red-800 dark:text-red-200 border border-red-200 dark:border-red-800'
          }`}
        >
          {message.text}
        </div>
      )}
    </div>
  );
}

