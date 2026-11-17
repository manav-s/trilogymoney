'use client';

import { useState } from 'react';

const MODES = {
  them: {
    label: 'other apps',
    items: [
      ['📊', 'build a budget'],
      ['🗂️', 'track every category'],
      ['📈', 'stare at charts'],
      ['😵‍💫', 'give up by february'],
    ],
  },
  trilogy: {
    label: 'trilogy',
    items: [
      ['🚫', 'no app to open'],
      ['🧘', 'just awareness'],
      ['💬', 'one text a week'],
      ['🤙', 'reply if you want'],
    ],
  },
} as const;

type Mode = keyof typeof MODES;

/** Segmented "other apps vs trilogy" switch with a sliding pill and a re-animating list. */
export default function CompareToggle() {
  const [mode, setMode] = useState<Mode>('trilogy');
  const isThem = mode === 'them';

  return (
    <div className="mt-8 pt-8 border-t border-gray-100">
      <div role="tablist" aria-label="compare" className="relative mx-auto grid w-64 grid-cols-2 rounded-full bg-gray-100 p-1 text-sm font-medium">
        <span
          aria-hidden
          className={`absolute inset-y-1 left-1 w-[calc(50%-4px)] rounded-full shadow-md transition-all duration-500 ease-[cubic-bezier(.3,1.4,.5,1)] ${
            isThem ? 'translate-x-0 bg-gray-700' : 'translate-x-full bg-blue-600'
          }`}
        />
        {(Object.keys(MODES) as Mode[]).map((m) => (
          <button
            key={m}
            type="button"
            role="tab"
            aria-selected={mode === m}
            onClick={() => setMode(m)}
            className={`relative z-10 rounded-full py-2 lowercase transition-colors duration-300 ${
              mode === m ? 'text-white' : 'text-gray-500 hover:text-gray-800'
            }`}
          >
            {MODES[m].label}
          </button>
        ))}
      </div>

      <div key={mode} className="mt-8 grid grid-cols-2 gap-6 sm:gap-8">
        {MODES[mode].items.map(([emoji, text], i) => (
          <div
            key={text}
            className="group space-y-2 animate-word-in"
            style={{ animationDelay: `${i * 80}ms` }}
          >
            <div className="text-3xl inline-block transition-transform duration-300 group-hover:scale-125 group-hover:-rotate-12">
              {emoji}
            </div>
            <p
              className={`font-medium ${
                isThem ? 'text-gray-400 line-through decoration-red-300 decoration-2' : 'text-gray-900'
              }`}
            >
              {text}
            </p>
          </div>
        ))}
      </div>
    </div>
  );
}
