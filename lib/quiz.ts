export type QuizQuestionType =
  | "single_choice"
  | "multi_choice"
  | "scale"
  | "boolean"
  | "free_text";

export interface QuizOption {
  id: string;
  label: string;
}

export interface QuizQuestionBase<TType extends QuizQuestionType> {
  id: string;
  type: TType;
  title: string;
  subtitle?: string;
  required?: boolean;
}

export type QuizQuestion =
  | (QuizQuestionBase<"single_choice"> & { options: QuizOption[] })
  | (QuizQuestionBase<"multi_choice"> & { options: QuizOption[]; maxSelect?: number })
  | (QuizQuestionBase<"scale"> & { min: number; max: number; minLabel?: string; maxLabel?: string })
  | QuizQuestionBase<"boolean">
  | QuizQuestionBase<"free_text">;

export interface QuizSpec {
  id: string;
  version: number;
  title: string;
  description?: string;
  questions: QuizQuestion[];
}

// Minimal, high-signal onboarding quiz
export const onboardingQuiz: QuizSpec = {
  id: "trilogy-onboarding",
  version: 1,
  title: "Let’s personalize your money pulse",
  description: "A quick set of questions to tailor your weekly iMessage.",
  questions: [
    {
      id: "goal_primary",
      type: "single_choice",
      title: "What’s your primary goal right now?",
      options: [
        { id: "save_more", label: "Save more each month" },
        { id: "pay_debt", label: "Pay down debt" },
        { id: "spend_smarter", label: "Spend smarter" },
        { id: "build_cushion", label: "Build a cushion" },
      ],
      required: true,
    },
    {
      id: "money_stress",
      type: "scale",
      title: "How stressed do finances feel right now?",
      subtitle: "Lower is calm, higher is chaotic",
      min: 1,
      max: 5,
      minLabel: "Calm",
      maxLabel: "Chaotic",
      required: true,
    },
    {
      id: "income_pattern",
      type: "single_choice",
      title: "How does your income arrive?",
      options: [
        { id: "steady", label: "Steady paycheck" },
        { id: "variable", label: "Variable/freelance" },
        { id: "mixed", label: "A mix of both" },
      ],
      required: true,
    },
    {
      id: "banks_connected",
      type: "boolean",
      title: "Do you have multiple bank/credit accounts to connect?",
      required: true,
    },
    {
      id: "notifications",
      type: "multi_choice",
      title: "Which weekly insights matter most?",
      subtitle: "Choose up to two",
      options: [
        { id: "spend_trends", label: "Spend trends" },
        { id: "cash_flow", label: "Cash flow" },
        { id: "savings_progress", label: "Savings progress" },
        { id: "upcoming_bills", label: "Upcoming bills" },
      ],
      maxSelect: 2,
    },
    {
      id: "free_text_focus",
      type: "free_text",
      title: "Anything specific you want Trilogy to focus on?",
    },
  ],
};

export type QuizAnswerValue =
  | string // single_choice id, free_text
  | string[] // multi_choice ids
  | number // scale
  | boolean; // boolean

export interface QuizAnswerRecord {
  questionId: string;
  value: QuizAnswerValue;
}

export function isValidAnswer(question: QuizQuestion, value: QuizAnswerValue): boolean {
  switch (question.type) {
    case "single_choice":
      return typeof value === "string" && question.options.some((o) => o.id === value);
    case "multi_choice":
      return (
        Array.isArray(value) &&
        value.every((v) => question.options.some((o) => o.id === v)) &&
        (question.maxSelect ? value.length <= question.maxSelect : true)
      );
    case "scale":
      return typeof value === "number" && value >= question.min && value <= question.max;
    case "boolean":
      return typeof value === "boolean";
    case "free_text":
      return typeof value === "string" && value.length <= 500;
    default:
      return false;
  }
}


