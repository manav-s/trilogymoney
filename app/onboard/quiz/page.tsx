"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { onboardingQuiz, QuizQuestion } from "@/lib/quiz";
import { ONBOARDING_PHONE_KEY } from "@/lib/constants";

export default function QuizPage() {
  const router = useRouter();
  const [phone, setPhone] = useState<string | null>(null);
  const [index, setIndex] = useState(0);
  const [submitting, setSubmitting] = useState(false);
  const questions = useMemo(() => onboardingQuiz.questions, []);

  useEffect(() => {
    const p = sessionStorage.getItem(ONBOARDING_PHONE_KEY);
    if (!p) {
      router.push("/");
      return;
    }
    setPhone(p);
  }, [router]);

  const current = questions[index] as QuizQuestion | undefined;

  async function saveAnswer(questionId: string, value: unknown) {
    if (!phone) return;
    await fetch("/api/onboard/quiz/save", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ phone, questionId, value }),
    });
  }

  async function handleNext(value: unknown) {
    if (!current) return;
    await saveAnswer(current.id, value);
    if (index < questions.length - 1) {
      setIndex((i) => i + 1);
    } else {
      // complete
      if (!phone) return;
      setSubmitting(true);
      const res = await fetch("/api/onboard/quiz/complete", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ phone }),
      });
      if (!res.ok) {
        setSubmitting(false);
        return;
      }
      router.push("/onboard/connect-banks");
    }
  }

  if (!phone || !current) {
    return (
      <div className="min-h-screen bg-white flex items-center justify-center">
        <div className="text-center">
          <div className="w-8 h-8 border-4 border-indigo-600 border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
          <p className="text-gray-600 lowercase">loading…</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-white">
      <div className="max-w-2xl mx-auto px-4 py-16">
        <div className="mb-12">
          <div className="flex items-center justify-between text-sm text-gray-500 mb-2 lowercase">
            <span>step 2 of 4</span>
            <span>{Math.round(((index + 1) / questions.length) * 100)}% complete</span>
          </div>
          <div className="w-full bg-gray-200 rounded-full h-2">
            <div className="bg-indigo-600 h-2 rounded-full" style={{ width: `${((index + 1) / questions.length) * 100}%` }}></div>
          </div>
        </div>

        <div className="mb-8">
          <h1 className="text-2xl sm:text-3xl font-semibold text-gray-900 mb-2 lowercase">{current.title}</h1>
          {current.subtitle && (
            <p className="text-gray-600 lowercase">{current.subtitle}</p>
          )}
        </div>

        <QuestionForm question={current} onNext={handleNext} submitting={submitting} />
      </div>
    </div>
  );
}

function QuestionForm({ question, onNext, submitting }: { question: QuizQuestion; onNext: (value: unknown) => void; submitting: boolean }) {
  const [value, setValue] = useState<unknown>();

  switch (question.type) {
    case "single_choice":
      return (
        <div className="space-y-4">
          {question.options.map((opt) => (
            <label key={opt.id} className="flex items-center gap-3 p-4 border rounded-xl cursor-pointer hover:bg-gray-50">
              <input type="radio" name={question.id} value={opt.id} onChange={() => setValue(opt.id)} />
              <span className="text-gray-900 lowercase">{opt.label}</span>
            </label>
          ))}
          <button onClick={() => onNext(value)} disabled={submitting || !value} className="mt-6 w-full px-10 py-5 text-xl font-semibold rounded-full bg-indigo-600 text-white disabled:opacity-50">
            {submitting ? "saving…" : "continue →"}
          </button>
        </div>
      );
    case "multi_choice":
      return (
        <MultiChoice question={question} onNext={onNext} submitting={submitting} />
      );
    case "scale":
      return (
        <div>
          <input type="range" min={question.min} max={question.max} defaultValue={Math.round((question.min + question.max) / 2)} onChange={(e) => setValue(Number(e.target.value))} className="w-full" />
          <div className="flex justify-between text-sm text-gray-500 mt-2 lowercase">
            <span>{question.minLabel || question.min}</span>
            <span>{question.maxLabel || question.max}</span>
          </div>
          <button onClick={() => onNext(value)} disabled={submitting || typeof value !== "number"} className="mt-6 w-full px-10 py-5 text-xl font-semibold rounded-full bg-indigo-600 text-white disabled:opacity-50">
            {submitting ? "saving…" : "continue →"}
          </button>
        </div>
      );
    case "boolean":
      return (
        <div className="space-y-4">
          <label className="flex items-center gap-3 p-4 border rounded-xl cursor-pointer hover:bg-gray-50">
            <input type="radio" name={question.id} value="true" onChange={() => setValue(true)} />
            <span className="text-gray-900 lowercase">Yes</span>
          </label>
          <label className="flex items-center gap-3 p-4 border rounded-xl cursor-pointer hover:bg-gray-50">
            <input type="radio" name={question.id} value="false" onChange={() => setValue(false)} />
            <span className="text-gray-900 lowercase">No</span>
          </label>
          <button onClick={() => onNext(value)} disabled={submitting || typeof value !== "boolean"} className="mt-6 w-full px-10 py-5 text-xl font-semibold rounded-full bg-indigo-600 text-white disabled:opacity-50">
            {submitting ? "saving…" : "continue →"}
          </button>
        </div>
      );
    case "free_text":
      return (
        <div>
          <textarea className="w-full px-4 py-3 border rounded-xl" rows={5} onChange={(e) => setValue(e.target.value)} placeholder="tell us anything you want us to focus on" />
          <button onClick={() => onNext(value)} disabled={submitting || typeof value !== "string"} className="mt-6 w-full px-10 py-5 text-xl font-semibold rounded-full bg-indigo-600 text-white disabled:opacity-50">
            {submitting ? "saving…" : "continue →"}
          </button>
        </div>
      );
    default:
      return null;
  }
}

function MultiChoice({ question, onNext, submitting }: { question: Extract<QuizQuestion, { type: "multi_choice" }>; onNext: (value: unknown) => void; submitting: boolean }) {
  const [selected, setSelected] = useState<string[]>([]);
  const toggle = (id: string) => {
    setSelected((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]));
  };
  const limit = question.maxSelect ?? Infinity;
  return (
    <div>
      <div className="space-y-3">
        {question.options.map((opt) => {
          const isChecked = selected.includes(opt.id);
          const atLimit = !isChecked && selected.length >= limit;
          return (
            <label key={opt.id} className={`flex items-center gap-3 p-4 border rounded-xl cursor-pointer ${atLimit ? "opacity-60" : "hover:bg-gray-50"}`}>
              <input type="checkbox" checked={isChecked} disabled={atLimit} onChange={() => toggle(opt.id)} />
              <span className="text-gray-900 lowercase">{opt.label}</span>
            </label>
          );
        })}
      </div>
      <button onClick={() => onNext(selected)} disabled={submitting} className="mt-6 w-full px-10 py-5 text-xl font-semibold rounded-full bg-indigo-600 text-white disabled:opacity-50">
        {submitting ? "saving…" : "continue →"}
      </button>
    </div>
  );
}


