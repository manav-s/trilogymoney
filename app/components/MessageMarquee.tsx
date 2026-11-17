const TEXTS = [
  'you spent less on food this week 👀',
  'spotify, netflix, hulu… your subs add up 🎧',
  'payday hit 💸',
  'uber eats 3x this week. we see you 🍟',
  'quiet week. barely spent a thing 🧘',
  'target run got a little out of hand 🎯',
  'coffee is your #1 category again ☕',
];

/** Endless, hover-to-pause strip of example texts. Pure CSS. */
export default function MessageMarquee() {
  const row = [...TEXTS, ...TEXTS];
  return (
    <section aria-label="example texts" className="py-10 bg-white overflow-hidden border-b border-gray-100">
      <p className="text-center text-xs uppercase tracking-[0.2em] text-gray-400 mb-6">the kind of texts you&apos;d get</p>
      <div className="group [mask-image:linear-gradient(to_right,transparent,#000_10%,#000_90%,transparent)]">
        <div className="flex w-max animate-marquee group-hover:[animation-play-state:paused]">
          {row.map((t, i) => (
            <div
              key={i}
              aria-hidden={i >= TEXTS.length}
              className="mr-3 shrink-0 rounded-3xl rounded-bl-md bg-gray-100 px-4 py-2.5 text-sm text-gray-800 transition-all duration-300 hover:-translate-y-1 hover:bg-[#007AFF] hover:text-white hover:shadow-lg hover:shadow-blue-200"
            >
              {t}
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
