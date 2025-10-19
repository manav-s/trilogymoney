"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";

const ONBOARDING_PHONE_KEY = "onboarding_phone";
const QUIZ_KEY = "onboarding_quiz_answers_v2";

type Answers = {
  q1?: string; q2?: string; q3?: string; q4?: string; q5?: string;
  q6?: string[]; // guilty pleasures multi
  q7?: string[]; // revolving debt multi
  q8?: string; q9?: string; q10?: string;
};

type Question = {
  key: keyof Answers;
  label: string;
  options: string[];
  type?: 'single' | 'multi';
  exclusiveNone?: boolean;
};

const QUESTIONS: Question[] = [
  { key: "q1", label: "most days, money feels…", options: ["calm","under_control","manageable","tense","overwhelming"] },
  { key: "q2", label: "what quietly worries you the most?", options: ["interest_charges","surprise_bills","overspending","not_saving","not_investing","nothing"] },
  { key: "q3", label: "if we nailed one win in 90 days, you’d want…", options: ["pay_down_card","build_1mo_cushion","stop_leak_spend","automate_bills","start_investing"] },
  { key: "q4", label: "the moment you drift off‑track is usually…", options: ["payday_slips","weekend_spend","late_night_scroll","unexpected_bill","social_plans"] },
  { key: "q5", label: "are you ever nervous to check your balances?", options: ["often","sometimes","rarely","never"] },
  { key: "q6", label: "any guilty pleasures?", options: ["food_delivery","prime","coffee","none"], type: 'multi', exclusiveNone: true },
  { key: "q7", label: "revolving debt right now?", options: ["none","credit_card","student","auto","other"], type: 'multi', exclusiveNone: true },
  { key: "q8", label: "your savings cushion feels like…", options: ["none","lt_1m","m_1_3","m_3_6","gt_6m"] },
  { key: "q9", label: "how do you keep track today?", options: ["none","notes","spreadsheet","app","bank_only"] },
  { key: "q10", label: "in a typical week, do you spend more than you meant to?", options: ["never","rarely","sometimes","often"] },
];

export default function QuizPage() {
  const router = useRouter();
  const [step, setStep] = useState(0);
  const [answers, setAnswers] = useState<Answers>({ q6: [], q7: [] });

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
        try { setAnswers(JSON.parse(raw)); } catch {}
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

  const toggleMulti = (key: keyof Answers, option: string) => {
    const prev = (answers[key] as string[] | undefined) ?? [];
    let next: string[] = [...prev];
    const idx = next.indexOf(option);
    if (idx >= 0) {
      next.splice(idx, 1);
    } else {
      // handle exclusive none
      if (option === 'none') {
        next = ['none'];
      } else {
        next = next.filter((v) => v !== 'none');
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
    <div className="min-h-screen bg-white">
      <div className="max-w-2xl mx-auto px-4 py-16">
        {/* progress */}
        <div className="mb-8">
          <div className="flex items-center justify-between text-sm text-gray-500 mb-2 lowercase">
            <span>question {step + 1} of {QUESTIONS.length}</span>
            <span>{progress}%</span>
          </div>
          <div className="w-full bg-gray-200 rounded-full h-2">
            <div className="bg-indigo-600 h-2 rounded-full" style={{ width: `${progress}%` }}></div>
          </div>
        </div>

        {/* question */}
        <h1 className="text-3xl font-bold text-gray-900 mb-6 lowercase">{current?.label}</h1>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {current?.options.map((opt) => {
            const active = isMulti
              ? Array.isArray(selected) && (selected as string[]).includes(opt)
              : selected === opt;
            const onClick = () => {
              if (isMulti) {
                toggleMulti(current.key, opt);
              } else {
                setAnswers({ ...answers, [current.key]: opt });
              }
            };
            return (
              <button
                key={opt}
                onClick={onClick}
                className={`px-6 py-4 rounded-2xl border-2 transition-all ${active ? "border-indigo-600 bg-indigo-50" : "border-gray-300 bg-white hover:border-gray-400"} lowercase text-left`}
              >
                {opt.replace(/_/g, " ")}
              </button>
            );
          })}
        </div>

        {/* nav */}
        <div className="mt-10 flex justify-between">
          <button onClick={goBack} disabled={step === 0} className="px-6 py-4 rounded-full bg-gray-100 text-gray-900 lowercase disabled:opacity-50">back</button>
          <button onClick={goNext} disabled={!hasAnswer} className="px-8 py-4 rounded-full bg-indigo-600 text-white lowercase hover:bg-indigo-700 disabled:opacity-50">{isLast ? "finish" : "next →"}</button>
        </div>
      </div>
    </div>
  );
}
