"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";

const ONBOARDING_PHONE_KEY = "onboarding_phone";
const QUIZ_KEY = "onboarding_quiz_answers_v2";

type Answers = {
  q1?: string; q2?: string[]; q3?: string; q4?: string; q5?: string;
  q6?: string[]; // guilty pleasures multi
  q7?: string[]; // revolving debt multi
  q8?: string; q9?: string; q10?: string;
};

type Question = {
  key: keyof Answers;
  label: string;
  options: string[];
  type?: 'single' | 'multi';
  variant?: 'default' | 'spectrum' | 'grid';
  exclusiveValues?: string[]; // options that are exclusive (selecting them clears others)
};

const LABELS: Record<string, string> = {
  // q1
  calm: 'calm — money rarely spikes my stress',
  under_control: 'under control — I know what’s coming and when',
  manageable: 'manageable — a bit messy but I keep up',
  tense: 'tense — I worry about it most weeks',
  overwhelming: 'overwhelming — money feels chaotic right now',

  // q2
  interest_charges: 'paying interest every month is draining me',
  surprise_bills: 'surprise bills keep catching me off‑guard',
  overspending: 'I spend more than I mean to, too often',
  not_saving: 'I’m not saving toward any cushion right now',
  not_investing: 'I’m not investing and feel behind',
  retiring_early_and_leaving_the_rat_race: 'retiring early and leaving the rat race feels out of reach',
  nothing: 'nothing really worries me right now',

  // q3
  pay_down_card: 'pay down a credit card and stop the interest',
  build_1mo_cushion: 'build a 1‑month emergency cushion',
  stop_leak_spend: 'plug leak‑spend and stick to a weekly target',
  automate_bills: 'automate bills so nothing slips through',
  start_investing: 'start investing consistently, even small amounts',

  // q4
  payday_slips: 'right after payday — I loosen up and overspend',
  weekend_spend: 'weekends — social plans derail the budget',
  late_night_scroll: 'late‑night scrolling leads to impulse buys',
  unexpected_bill: 'a surprise expense knocks everything off course',
  social_plans: 'saying yes to plans when I shouldn’t',

  // shared enums (fallbacks; per-question overrides below)
  often: 'often',
  sometimes: 'sometimes',
  rarely: 'rarely',
  never: 'never',

  // q6 guilty pleasures
  food_delivery: 'food delivery — doordash, ubereats, etc adds up',
  prime: 'amazon prime and quick “add to cart” buys',
  coffee: 'coffee runs — small but frequent',
  none: 'none',

  // q7 debt
  credit_card: 'credit card balance I carry month to month',
  student: 'student loans I’m still paying',
  auto: 'auto loan or lease payment',
  other: 'other revolving debt (medical, personal, etc.)',

  // q8 cushion
  lt_1m: 'less than 1 month of expenses saved',
  m_1_3: 'about 1–3 months of expenses saved',
  m_3_6: 'about 3–6 months of expenses saved',
  gt_6m: 'more than 6 months of expenses saved',

  // q9 tracking
  notes: 'simple notes app checklists',
  spreadsheet: 'a spreadsheet I update by hand',
  app: 'a money app I try to keep up with',
  bank_only: 'I just check my bank or card apps',
};

// Per-question label overrides for shared enums
const LABEL_OVERRIDES: Partial<Record<keyof Answers, Record<string, string>>> = {
  q2: {
    interest_charges: 'paying interest',
    surprise_bills: 'surprise bills',
    overspending: 'overspending',
    not_saving: 'not saving',
    not_investing: 'not investing',
    retiring_early_and_leaving_the_rat_race: 'retiring early',
    nothing: 'nothing',
  },
  q3: {
    pay_down_card: 'pay down debt',
    build_1mo_cushion: 'build emergency fund',
    stop_leak_spend: 'stop overspending',
    start_investing: 'start investing',
  },
  q4: {
    payday_slips: 'right after payday',
    weekend_spend: 'social plans on the weekend',
    late_night_scroll: 'late night impulse buys',
    unexpected_bill: 'big surprise expense',
    social_plans: "not saying 'no' to dinner plans",
  },
  q5: {
    often: 'often — I avoid looking',
    sometimes: 'sometimes — depends on the week',
    rarely: 'rarely — I feel fine checking',
    never: 'never — no stress at all',
  },
  q6: {
    food_delivery: 'food delivery',
    prime: 'amazon prime',
    coffee: 'coffee runs',
    none: 'none of these',
  },
  q7: {
    credit_card: 'credit card balance',
    student: 'student loans',
    auto: 'auto loan or lease',
    other: 'other debt',
    none: 'no revolving debt right now',
  },
  q10: {
    never: 'never — I hit my plan most weeks',
    rarely: 'rarely — small misses happen occasionally',
    sometimes: 'sometimes — I drift more than I’d like',
    often: 'often — I need tighter rails',
  },
};
const labelFor = (key: keyof Answers, value: string): string =>
  LABEL_OVERRIDES[key]?.[value] ?? LABELS[value] ?? value.replace(/_/g, ' ');

const QUESTIONS: Question[] = [
  { key: "q1", label: "most days, money feels…", options: ["calm","under_control","manageable","tense","overwhelming"], variant: 'spectrum' },
  { key: "q2", label: "what quietly worries you the most?", options: ["interest_charges","surprise_bills","overspending","not_saving","not_investing"], type: 'multi' },
  { key: "q3", label: "if we nailed one win in 90 days, you'd want…", options: ["pay_down_card","build_1mo_cushion","stop_leak_spend","start_investing"] },
  { key: "q4", label: "the moment you drift off‑track is usually…", options: ["payday_slips","weekend_spend","late_night_scroll","unexpected_bill","social_plans"] },
  { key: "q5", label: "are you ever nervous to check your balances?", options: ["often","sometimes","rarely","never"] },
  { key: "q6", label: "any guilty pleasures?", options: ["food_delivery","prime","coffee","none"], type: 'multi', exclusiveValues: ["none"] },
  { key: "q7", label: "revolving debt right now?", options: ["none","credit_card","student","auto","other"], type: 'multi', exclusiveValues: ["none"] },
  { key: "q8", label: "your savings cushion feels like…", options: ["none","lt_1m","m_1_3","m_3_6","gt_6m"] },
  { key: "q9", label: "how do you keep track today?", options: ["none","notes","spreadsheet","app","bank_only"] },
  { key: "q10", label: "in a typical week, do you spend more than you meant to?", options: ["never","rarely","sometimes","often"] },
];

export default function QuizPage() {
  const router = useRouter();
  const [step, setStep] = useState(0);
  const [answers, setAnswers] = useState<Answers>({ q2: [], q6: [], q7: [] });

  // load persisted answers
  useEffect(() => {
    const phone = sessionStorage.getItem(ONBOARDING_PHONE_KEY);
    if (!phone) {
      router.replace("/");
      return;
    }
    (async () => {
      try {
        const res = await fetch(`/api/onboard/status?phone=${encodeURIComponent(phone)}`);
        if (res.ok) {
          const data = await res.json();
          if (data.next && data.next !== "/onboard/quiz") {
            router.replace(data.next);
            return;
          }
        }
      } catch {}
      const raw = sessionStorage.getItem(QUIZ_KEY);
      if (raw) {
        try {
          const parsed = JSON.parse(raw);
          // migrate legacy single-selection q2 to array
          if (parsed && typeof parsed.q2 === 'string') {
            parsed.q2 = parsed.q2 ? [parsed.q2] : [];
          }
          setAnswers(parsed);
        } catch {}
      }
    })();
  }, [router]);

  // persist on change
  useEffect(() => {
    sessionStorage.setItem(QUIZ_KEY, JSON.stringify(answers));
  }, [answers]);

  const current = QUESTIONS[step];
  const progress = useMemo(() => Math.round(((step + 1) / QUESTIONS.length) * 100), [step]);

  const selected = answers[current?.key as keyof Answers];
  const isMulti = current?.type === 'multi';
  const hasAnswer = isMulti ? Array.isArray(selected) && (selected as string[]).length > 0 : !!selected;
  const isLast = step === QUESTIONS.length - 1;

  const toggleMulti = (question: Question, option: string) => {
    const key = question.key;
    const prev = (answers[key] as string[] | undefined) ?? [];
    let next: string[] = [...prev];
    const idx = next.indexOf(option);
    if (idx >= 0) {
      next.splice(idx, 1);
    } else {
      const exclusive = new Set(question.exclusiveValues ?? []);
      if (exclusive.has(option)) {
        next = [option];
      } else {
        next = next.filter((v) => !exclusive.has(v));
        next.push(option);
      }
    }
    setAnswers({ ...answers, [key]: next });
  };

  const goNext = async () => {
    if (!hasAnswer) return;
    if (isLast) {
      // submit
      const phone = sessionStorage.getItem(ONBOARDING_PHONE_KEY);
      if (!phone) { router.replace("/"); return; }
      try {
        const res = await fetch("/api/onboard/quiz", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ phone, answers, version: 1 }),
        });
        if (res.ok) {
          const data = await res.json();
          router.push(data.next || "/onboard/analyzing");
        }
      } catch {}
      return;
    }
    setStep((s) => Math.min(s + 1, QUESTIONS.length - 1));
  };

  const goBack = () => setStep((s) => Math.max(s - 1, 0));

  return (
    <div className="min-h-screen bg-gray-50 relative overflow-hidden">
      <div className="absolute top-0 left-0 w-full h-full bg-[radial-gradient(#e5e7eb_1px,transparent_1px)] [background-size:16px_16px] [mask-image:radial-gradient(ellipse_50%_50%_at_50%_50%,#000_70%,transparent_100%)] opacity-50"></div>
      <div className="max-w-2xl mx-auto px-4 py-16 relative z-10">
        {/* progress */}
        <div className="mb-8">
          <div className="flex items-center justify-between text-sm text-gray-500 mb-2 lowercase">
            <span>question {step + 1} of {QUESTIONS.length}</span>
            <span>{progress}%</span>
          </div>
          <div className="w-full bg-gray-200/50 rounded-full h-2 backdrop-blur-sm">
            <div className="bg-blue-600 h-2 rounded-full transition-all duration-500 ease-out shadow-[0_0_10px_rgba(37,99,235,0.3)]" style={{ width: `${progress}%` }}></div>
          </div>
        </div>

        {/* question */}
        <h1 className="text-3xl font-bold text-gray-900 mb-6 lowercase">{current?.label}</h1>
        <div className={`grid gap-3 ${current?.variant === 'grid' ? 'grid-cols-2' : 'grid-cols-1'}`}>
          {current?.variant === 'spectrum' ? (
            <div className="py-8 col-span-full">
              {/* Emoji Spectrum Slider */}
              <div className="relative mb-12 px-4">
                {/* Track */}
                <div className="absolute top-1/2 left-4 right-4 h-2 bg-gray-200 rounded-full -translate-y-1/2">
                  <div className="absolute top-0 left-0 h-full bg-gradient-to-r from-green-400 via-yellow-400 to-red-500 rounded-full opacity-50"></div>
                </div>
                
                {/* Emojis */}
                <div className="relative flex justify-between">
                  {current.options.map((opt, i) => {
                    const isSelected = selected === opt;
                    const emoji = {
                      calm: "😁",
                      under_control: "🙂",
                      manageable: "😐",
                      tense: "😕",
                      overwhelming: "😰"
                    }[opt] || "🤔";
                    
                    return (
                      <button
                        key={opt}
                        onClick={() => setAnswers({ ...answers, [current.key]: opt })}
                        className={`relative group transition-all duration-300 ${isSelected ? 'scale-125 z-10' : 'hover:scale-110'}`}
                      >
                        <div className={`w-12 h-12 flex items-center justify-center rounded-full text-3xl bg-white shadow-lg border-2 transition-all duration-300 ${isSelected ? 'border-blue-500 shadow-blue-500/30' : 'border-transparent hover:border-gray-200'}`}>
                          {emoji}
                        </div>
                        {/* Label tooltip for non-selected items */}
                        {!selected && (
                          <span className="absolute -bottom-8 left-1/2 -translate-x-1/2 text-xs text-gray-400 opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap">
                            {opt.replace(/_/g, ' ')}
                          </span>
                        )}
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Selected Description Card */}
              <div className={`transition-all duration-500 ${selected ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-4'}`}>
                {selected && (
                  <div className="bg-white/60 backdrop-blur-xl border border-white/20 p-6 rounded-2xl text-center shadow-lg">
                    <p className="text-xl font-medium text-gray-900 mb-2">
                      {labelFor(current.key, selected as string).split('—')[0]}
                    </p>
                    <p className="text-gray-600">
                      {labelFor(current.key, selected as string).split('—')[1] || labelFor(current.key, selected as string)}
                    </p>
                  </div>
                )}
                {!selected && (
                  <div className="text-center text-gray-400 py-6">
                    tap an emoji to select
                  </div>
                )}
              </div>
            </div>
          ) : (
            /* Standard List Options */
            current?.options.map((opt) => {
              const active = isMulti
                ? Array.isArray(selected) && (selected as string[]).includes(opt)
                : selected === opt;
              const onClick = () => {
                if (isMulti) {
                  toggleMulti(current, opt);
                } else {
                  setAnswers({ ...answers, [current.key]: opt });
                }
              };
              return (
                <button
                  key={opt}
                  onClick={onClick}
                  className={`px-6 py-5 rounded-2xl border transition-all duration-300 ${active ? "border-blue-500 bg-blue-50/50 shadow-lg shadow-blue-500/10 scale-[1.02]" : "border-white/40 bg-white/60 backdrop-blur-md hover:border-blue-300 hover:bg-white/80 hover:shadow-md hover:scale-[1.01]"} lowercase text-left group`}
                >
                  <span className={`text-lg font-medium ${active ? "text-blue-700" : "text-gray-700 group-hover:text-gray-900"}`}>
                    {labelFor(current.key, opt)}
                  </span>
                </button>
              );
            })
          )}
        </div>

        {/* nav */}
        <div className="mt-10 flex justify-between">
          <button onClick={goBack} disabled={step === 0} className="px-6 py-4 rounded-full bg-gray-100 text-gray-900 lowercase disabled:opacity-50 hover:bg-gray-200 transition-all duration-200">back</button>
          <button onClick={goNext} disabled={!hasAnswer} className="px-8 py-4 rounded-full bg-[#007AFF] text-white lowercase hover:bg-[#0051D5] disabled:opacity-50 transition-all duration-300 hover:shadow-lg hover:-translate-y-0.5">{isLast ? "finish" : "next →"}</button>
        </div>
      </div>
    </div>
  );
}
