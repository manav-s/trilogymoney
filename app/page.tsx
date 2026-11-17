import { Lock, ShieldCheck, EyeOff, ChevronDown, type LucideIcon } from "lucide-react";
import SocialProofBadge from "./components/SocialProofBadge";
import NavBar from "./components/NavBar";
import PhoneDemo from "./components/PhoneDemo";
import HowItWorks from "./components/HowItWorks";
import ScrollWords from "./components/ScrollWords";
import MessageMarquee from "./components/MessageMarquee";
import HeartBurst from "./components/HeartBurst";
import Reveal from "./components/motion/Reveal";
import CountUp from "./components/motion/CountUp";
import ScrollProgress from "./components/motion/ScrollProgress";
import SpotlightCard from "./components/motion/SpotlightCard";
import HeroParallax from "./components/motion/HeroParallax";
import IntroCurtain from "./components/fx/IntroCurtain";
import CustomCursor from "./components/fx/CustomCursor";
import HeroParticles from "./components/fx/HeroParticles";
import ScrambleText from "./components/fx/ScrambleText";
import ChaosScene from "./components/fx/ChaosScene";
import UserHeart from "./components/fx/UserHeart";
import EasterEgg, { SecretLogo } from "./components/fx/EasterEgg";

const USER_COUNT = 129;

const SECURITY_FEATURES: { Icon: LucideIcon; title: string; body: string }[] = [
  {
    Icon: Lock,
    title: "bank-grade encryption",
    body: "we utilize aes-256 encryption for all data at rest and in transit.",
  },
  {
    Icon: ShieldCheck,
    title: "trusted infrastructure",
    body: "we partner with plaid to securely connect your accounts without ever seeing your credentials.",
  },
  {
    Icon: EyeOff,
    title: "privacy first",
    body: "we do not sell your personal data. your financial privacy is our core commitment.",
  },
  {
    Icon: Lock,
    title: "end-to-end encrypted",
    body: "all messages sent via imessage are end-to-end encrypted by apple.",
  },
];

const HEADLINE_LINE_1 = ["your", "money's"];

export default function Home() {
  return (
    <div className="min-h-screen bg-white selection:bg-blue-100 selection:text-blue-900 overflow-x-clip">
      <IntroCurtain />
      <CustomCursor />
      <EasterEgg />
      <ScrollProgress />
      <NavBar />

      {/* Hero Section */}
      <HeroParallax>
        <main className="relative pt-32 pb-16 sm:pt-40 sm:pb-24 overflow-hidden">
          <HeroParticles />
          {/* Background gradients drift with the cursor */}
          <div className="absolute top-0 left-1/2 -translate-x-1/2 w-full h-full max-w-7xl -z-10 pointer-events-none">
            <div
              className="absolute top-20 left-20 w-72 h-72 bg-blue-400/20 rounded-full blur-3xl animate-pulse mix-blend-multiply transition-[translate] duration-700 ease-out"
              style={{ translate: "calc(var(--mx) * 50px) calc(var(--my) * 40px)" }}
            />
            <div
              className="absolute top-40 right-20 w-96 h-96 bg-indigo-400/20 rounded-full blur-3xl animate-pulse mix-blend-multiply transition-[translate] duration-700 ease-out"
              style={{ translate: "calc(var(--mx) * -40px) calc(var(--my) * 30px)" }}
            />
            <div
              className="absolute -bottom-20 left-1/2 w-80 h-80 bg-purple-400/20 rounded-full blur-3xl animate-pulse mix-blend-multiply transition-[translate] duration-700 ease-out"
              style={{ translate: "calc(var(--mx) * 30px) calc(var(--my) * -50px)" }}
            />
          </div>

          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="grid lg:grid-cols-2 gap-12 lg:gap-20 items-center">
              {/* Left side - Content */}
              <div className="space-y-8 text-center lg:text-left">
                {/* Social proof - mobile only */}
                <div className="flex justify-center md:hidden mb-4 animate-word-in" style={{ animationDelay: "var(--intro, 0s)" }}>
                  <SocialProofBadge />
                </div>

                <div className="inline-flex items-center px-3 py-1 rounded-full bg-blue-50 border border-blue-100 text-blue-600 text-[10px] min-[400px]:text-xs font-medium uppercase tracking-wide sm:tracking-wider mb-4 whitespace-nowrap animate-word-in hover:scale-105 transition-transform" style={{ animationDelay: "var(--intro, 0s)" }}>
                  <span className="relative flex h-2 w-2 mr-2">
                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-blue-400 opacity-75"></span>
                    <span className="relative inline-flex rounded-full h-2 w-2 bg-blue-500"></span>
                  </span>
                  the only imessage native finance tracker
                </div>

                <h1 className="text-5xl sm:text-6xl lg:text-7xl font-bold tracking-tight text-gray-900 leading-[1.1]">
                  {HEADLINE_LINE_1.map((word, i) => (
                    <span key={word} className="inline-block animate-word-in cursor-default transition-[translate,rotate] duration-300 hover:-translate-y-2 hover:-rotate-3" style={{ animationDelay: `calc(var(--intro, 0s) + ${150 + i * 90}ms)` }}>
                      {word}
                      {i < HEADLINE_LINE_1.length - 1 && " "}
                    </span>
                  ))}
                  <br />
                  <span className="inline-block animate-word-in" style={{ animationDelay: "calc(var(--intro, 0s) + 380ms)" }}>
                    <span className="relative inline-block">
                      <span className="text-transparent bg-clip-text bg-[linear-gradient(90deg,#007AFF,#5856D6,#AF52DE,#007AFF)] bg-[length:200%_auto] animate-shimmer">
                        personal assistant.
                      </span>
                      <svg aria-hidden viewBox="0 0 300 20" preserveAspectRatio="none" className="absolute -bottom-3 left-0 h-4 w-full overflow-visible">
                        <path
                          d="M4 14 C 60 4, 120 4, 170 10 S 260 16, 296 6"
                          fill="none"
                          stroke="url(#underline-grad)"
                          strokeWidth="5"
                          strokeLinecap="round"
                          pathLength={1}
                          className="animate-draw"
                          style={{ animationDelay: "calc(var(--intro, 0s) + 1100ms)" }}
                        />
                        <defs>
                          <linearGradient id="underline-grad" x1="0" x2="1">
                            <stop offset="0" stopColor="#007AFF" />
                            <stop offset="1" stopColor="#AF52DE" />
                          </linearGradient>
                        </defs>
                      </svg>
                    </span>
                  </span>
                </h1>

                <p
                  className="text-xl sm:text-2xl text-gray-600 leading-relaxed max-w-2xl mx-auto lg:mx-0 animate-word-in"
                  style={{ animationDelay: "calc(var(--intro, 0s) + 550ms)" }}
                >
                  texts you via imessage like a friend. once a week, a quick money check-in.
                </p>

                <div className="animate-word-in" style={{ animationDelay: "calc(var(--intro, 0s) + 700ms)" }}>
                  <a
                    data-magnetic
                    href="#how-it-works"
                    className="group inline-flex items-center gap-2 rounded-full border border-gray-200 bg-white/70 backdrop-blur px-5 py-2.5 text-sm font-medium text-gray-700 lowercase shadow-sm transition-all hover:border-blue-200 hover:text-blue-600 hover:shadow-md"
                  >
                    see how it worked
                    <ChevronDown className="w-4 h-4 animate-bounce group-hover:text-blue-600" />
                  </a>
                </div>
              </div>

              {/* Right side - interactive iPhone */}
              <div className="relative flex justify-center lg:justify-end animate-word-in" style={{ animationDelay: "calc(var(--intro, 0s) + 300ms)" }}>
                <PhoneDemo />
              </div>
            </div>
          </div>
        </main>
      </HeroParallax>

      {/* Retired Project Banner */}
      <div className="relative overflow-hidden bg-gray-900 text-white text-center py-5 px-4">
        <div
          aria-hidden
          className="absolute inset-0 bg-[linear-gradient(110deg,transparent_30%,rgba(255,255,255,0.08)_50%,transparent_70%)] bg-[length:250%_100%] animate-shimmer"
        />
        <p className="relative text-sm font-medium">
          🎓 trilogy is now retired. thank you to all {USER_COUNT} of you who gave it a try 💙
        </p>
      </div>

      <MessageMarquee />

      {/* Problem statement: pinned scroll scene */}
      <ChaosScene />

      {/* How it works */}
      <section id="how-it-works" className="py-24 sm:py-32 bg-white relative scroll-mt-16">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
          <Reveal>
            <h2 className="text-4xl sm:text-5xl font-bold text-center text-gray-900 mb-20">
              <ScrambleText text="how it works" />
            </h2>
          </Reveal>
          <Reveal delay={100}>
            <HowItWorks />
          </Reveal>
        </div>
      </section>

      {/* Why this works Section */}
      <section className="bg-gray-900 relative overflow-hidden">
        <SpotlightCard tilt={false} size={700} color="rgba(99,102,241,0.18)" className="py-24 sm:py-32">
          {/* Slow-spinning aurora */}
          <div
            aria-hidden
            className="pointer-events-none absolute left-1/2 top-1/2 h-[700px] w-[700px] -translate-x-1/2 -translate-y-1/2 rounded-full bg-[conic-gradient(from_0deg,#3b82f6,#8b5cf6,#ec4899,#06b6d4,#3b82f6)] opacity-[0.12] blur-3xl animate-[spin_20s_linear_infinite]"
          />
          {/* Subtle background glow */}
          <div className="absolute top-0 left-1/2 -translate-x-1/2 w-full h-full max-w-4xl opacity-20 pointer-events-none">
            <div className="absolute top-1/4 left-1/4 w-96 h-96 bg-blue-500/30 rounded-full blur-3xl mix-blend-screen animate-float delay-100"></div>
            <div className="absolute bottom-1/4 right-1/4 w-96 h-96 bg-indigo-500/30 rounded-full blur-3xl mix-blend-screen animate-float delay-300"></div>
          </div>

          <div className="max-w-3xl mx-auto px-6 lg:px-8 relative z-10 text-center">
            <Reveal>
              <h2 className="text-3xl sm:text-4xl font-bold text-white mb-12 lowercase tracking-tight">
                <ScrambleText text="why this works" />
              </h2>
            </Reveal>

            <div className="space-y-12">
              <div className="space-y-6">
                <ScrollWords
                  text="you don't need another app telling you what to do with your money."
                  className="text-xl sm:text-2xl text-gray-300 font-light leading-relaxed lowercase"
                />
                <Reveal from="scale">
                  <p className="text-3xl sm:text-4xl font-semibold text-white leading-tight lowercase">
                    you just need to know <br className="hidden sm:block" />
                    <span className="inline-block text-transparent bg-clip-text bg-[linear-gradient(90deg,#60a5fa,#818cf8,#c084fc,#60a5fa)] bg-[length:200%_auto] animate-shimmer">
                      where you&apos;re at.
                    </span>
                  </p>
                </Reveal>
              </div>

              <div className="space-y-8 pt-8 border-t border-white/10">
                <Reveal>
                  <p className="text-lg text-gray-400 leading-relaxed max-w-2xl mx-auto lowercase">
                    seeing the numbers once a week. noticing patterns. staying intentional. that alone can ease the anxiety
                    of &quot;i don&apos;t even know what&apos;s going on with my money.&quot;
                  </p>
                </Reveal>

                <Reveal delay={100}>
                  <div className="inline-block px-6 py-3 rounded-full bg-white/5 border border-white/10 backdrop-blur-sm transition-all duration-300 hover:bg-white/10 hover:border-white/20 hover:scale-105">
                    <p className="text-sm text-gray-300 lowercase">no judgment. no lectures. no $200/month financial advisor.</p>
                  </div>
                </Reveal>

                <Reveal delay={200}>
                  <p className="text-lg text-white font-medium lowercase">
                    trilogy gives you clarity. what you do with it is totally up to you.
                  </p>
                </Reveal>
              </div>
            </div>
          </div>
        </SpotlightCard>
      </section>

      {/* Security Section */}
      <section className="py-24 sm:py-32 bg-white relative overflow-hidden">
        <div className="max-w-7xl mx-auto px-6 lg:px-8 relative z-10">
          <Reveal className="text-center max-w-3xl mx-auto mb-16">
            <h2 className="text-3xl sm:text-4xl font-bold text-gray-900 mb-6 lowercase">
              <ScrambleText text="uncompromising security." />
            </h2>
            <p className="text-lg text-gray-600 lowercase">
              your financial data is protected with industry-standard encryption and security best practices, designed by
              a team of security engineers with experience from Microsoft and JP Morgan Chase & Co.
            </p>

            {/* Trust badges */}
            <div className="flex flex-wrap items-center justify-center gap-6 mt-8">
              <div className="flex items-center gap-2 px-4 py-2 bg-gray-50 rounded-lg border border-gray-200 transition-all hover:-translate-y-0.5 hover:shadow-md hover:border-blue-200">
                <ShieldCheck className="w-5 h-5 text-blue-600" />
                <span className="text-sm font-semibold text-gray-700">SOC 2 Compliant</span>
              </div>
              <div className="flex items-center gap-2 px-4 py-2 bg-gray-50 rounded-lg border border-gray-200 transition-all hover:-translate-y-0.5 hover:shadow-md hover:border-blue-200">
                <Lock className="w-5 h-5 text-blue-600" />
                <span className="text-sm font-semibold text-gray-700">GDPR Compliant</span>
              </div>
            </div>
          </Reveal>

          <div className="grid md:grid-cols-4 gap-8 lg:gap-12">
            {SECURITY_FEATURES.map(({ Icon, title, body }, i) => (
              <Reveal key={title} delay={i * 100} className="h-full">
                <SpotlightCard className="h-full rounded-2xl bg-gray-50 border border-gray-100 shadow-sm hover:shadow-xl hover:border-blue-100">
                  <div className="flex flex-col items-center text-center p-6">
                    <div className="w-12 h-12 bg-blue-100 rounded-xl flex items-center justify-center mb-6 text-blue-600 transition-all duration-300 group-hover:bg-blue-600 group-hover:text-white group-hover:scale-110 group-hover:-rotate-6">
                      <Icon className="w-6 h-6" />
                    </div>
                    <h3 className="text-xl font-semibold text-gray-900 mb-3 lowercase">{title}</h3>
                    <p className="text-gray-600 lowercase">{body}</p>
                  </div>
                </SpotlightCard>
              </Reveal>
            ))}
          </div>
        </div>
      </section>

      {/* Thank you */}
      <section className="py-24 sm:py-32 bg-white relative overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-b from-white to-blue-50/50"></div>
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 text-center space-y-10 relative z-10">
          <Reveal from="scale">
            <p className="text-xs uppercase tracking-[0.25em] text-blue-600 font-semibold mb-8">
              <ScrambleText text="thank you" />
            </p>
            <UserHeart count={USER_COUNT} />
            <div className="mt-6 text-7xl sm:text-8xl font-bold tracking-tight text-gray-900">
              <CountUp to={USER_COUNT} duration={1800} />
            </div>
            <p className="mt-3 text-lg text-gray-500 lowercase">people trusted trilogy with their money.</p>
            <p className="mt-1 text-xs text-gray-400 lowercase">every dot is one of you. go ahead, poke the heart.</p>
          </Reveal>

          <Reveal delay={150}>
            <h2 className="text-4xl min-[400px]:text-5xl sm:text-6xl font-bold text-gray-900 tracking-tight">
              thanks for being part of the journey.
            </h2>
          </Reveal>

          <Reveal delay={250}>
            <p className="text-xl text-gray-600">
              trilogy is now retired. to all {USER_COUNT} of our users: thank you for every text you read, every reply you
              sent, and every bit of feedback along the way.
            </p>
          </Reveal>

          <Reveal delay={350}>
            <HeartBurst />
          </Reveal>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t border-gray-100 bg-white">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
          <div className="flex flex-col sm:flex-row items-center justify-between space-y-4 sm:space-y-0">
            <SecretLogo />
            <div className="flex items-center space-x-8 text-sm font-medium text-gray-500">
              <a href="/pricing" className="hover:text-blue-600 transition-colors">
                pricing
              </a>
              <a href="/privacy" className="hover:text-blue-600 transition-colors">
                privacy
              </a>
            </div>
            <p className="text-sm text-gray-400" title="psst: type “money”">© 2025 trilogy</p>
          </div>
        </div>
      </footer>
    </div>
  );
}
