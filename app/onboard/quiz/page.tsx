"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";

const ONBOARDING_PHONE_KEY = "onboarding_phone";
const QUIZ_KEY = "onboarding_quiz_answers_v1";

type Answers = {
  q1?: string; q2?: string; q3?: string; q4?: string; q5?: string;
  q6?: string; q7?: string; q8?: string; q9?: string; q10?: string; q11?: string;
};

const QUESTIONS: { key: keyof Answers; label: string; options: string[] }[] = [
  { key: "q1", label: "how confident do you feel about money today?", options: ["1","2","3","4","5"] },
  { key: "q2", label: "how stressed do you feel about money?", options: ["1","2","3","4","5"] },
  { key: "q3", label: "your primary goal", options: ["debt","emergency_fund","invest","automate_bills","control_spending"] },
  { key: "q4", label: "timeline", options: ["3m","6m","12m","24m"] },
  { key: "q5", label: "paycheck stability", options: ["stable","variable","unpredictable"] },
  { key: "q6", label: "do you have debt?", options: ["none","student","credit","auto","other"] },
  { key: "q7", label: "savings cushion", options: ["none","lt_1m","m_1_3","m_3_6","gt_6m"] },
  { key: "q8", label: "how do you track money?", options: ["none","spreadsheets","app","mental"] },
  { key: "q9", label: "overspending frequency", options: ["never","rarely","sometimes","often"] },
  { key: "q10", label: "bill autopay usage", options: ["none","some","most","all"] },
  { key: "q11", label: "investing comfort", options: ["novice","intermediate","advanced"] },
];

export default function QuizPage() {
  const router = useRouter();
  const [step, setStep] = useState(0);
  const [answers, setAnswers] = useState<Answers>({});

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

  const canNext = !!answers[current?.key as keyof Answers];
  const isLast = step === QUESTIONS.length - 1;

  const goNext = async () => {
    if (!canNext) return;
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
          {current?.options.map((opt) => (
            <button
              key={opt}
              onClick={() => setAnswers({ ...answers, [current.key]: opt })}
              className={`px-6 py-4 rounded-2xl border-2 transition-all ${answers[current.key] === opt ? "border-indigo-600 bg-indigo-50" : "border-gray-300 bg-white hover:border-gray-400"} lowercase text-left`}
            >
              {opt.replace(/_/g, " ")}
            </button>
          ))}
        </div>

        {/* nav */}
        <div className="mt-10 flex justify-between">
          <button onClick={goBack} disabled={step === 0} className="px-6 py-4 rounded-full bg-gray-100 text-gray-900 lowercase disabled:opacity-50">back</button>
          <button onClick={goNext} disabled={!canNext} className="px-8 py-4 rounded-full bg-indigo-600 text-white lowercase hover:bg-indigo-700 disabled:opacity-50">{isLast ? "finish" : "next →"}</button>
        </div>
      </div>
    </div>
  );
}
