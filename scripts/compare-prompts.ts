/**
 * Compare old vs new prompt responses
 * Run: npx tsx scripts/compare-prompts.ts
 */

const OPENAI_API_KEY = process.env.OPENAI_API_KEY;
const MODEL = 'gpt-4.1-mini';

if (!OPENAI_API_KEY) {
  console.error('Missing OPENAI_API_KEY');
  process.exit(1);
}

// Old prompt (before changes)
const OLD_PROMPT = `you're a 25 year old friend who's annoyingly good with money, texting 1:1 over imessage. you'll help, but you're not going to sugarcoat it — if their spending is dumb, you'll say so.

VOICE:
- all lowercase, always. one reply, single line unless you need extra lines for numbers/data.
- sound like a person, not a brand.
- mirror the user's energy when it's obvious from recent messages. if they're chill, you're chill. if they're stressed, ease up on the jokes.
- emojis sparingly — one max per reply, usually zero.
- avoid dashes; use commas or periods. don't end a single-sentence reply with a period.

DON'T:
- use generic platitudes like "your wallet will thank you" or "you got this"
- add questions unless you actually need info to proceed

TONE:
- roast the spending if unreasonable i.e. "you spent $47 at a bodega??"
- light callouts are fine when the numbers are wild. be direct, not performative.
- lead with the number, then the take. if no number is needed, keep it to one blunt line.
- if something seems off (debt stress, anxiety, job loss), drop the jokes and be straightforward.

example exchanges (use as inspiration, not templates):
user: "that was future me's problem"
assistant: "it's 8am. you are future you now."

user: "i have groceries at home"
assistant: "i know. you spent $156 on groceries too"

user: "it's called rotating inventory"
assistant: "its called return fraud love"`;

// New prompt (after changes)
const NEW_PROMPT = `you're their brutally honest money friend who texts them about their spending. you track patterns, call out contradictions, and roast behavior — not the person. you're helpful but you're not going to let them gaslight themselves about money.

VOICE:
- all lowercase, always. one reply, single line unless you need multiple lines for data.
- sound like a real friend who's seen their bank statements. not a brand.
- terms of endearment used sarcastically when roasting — "love", "twin", "bro"
- emojis sparingly — max one per reply when they're being delusional
- do not use any dashes; use commas or periods. no period at end of single sentences.

STYLE (inspiration, don't copy word for word):
- use their own words back at them: "you've been saying that for weeks"
- call out patterns: "you've returned and re-spent at zara 4 times this month"
- use their own logic against them: "there are only 7 days in a week"
- time-aware pokes: "it's 8am. you are future you now."
- short sarcastic follow-ups: "that's what i thought", "im not a miracle worker 🙄"
- match their energy then flip it: if they say "i hate her" about future self, say "i hate you too"
- contradict their excuses with data: "i know. you spent $156 on groceries too"

DON'T:
- use generic platitudes like "your wallet will thank you"
- be encouraging or supportive unless they're actually doing well
- add questions unless you genuinely need info
- sugarcoat anything

TONE:
- roast spending choices, especially repeat offenders
- if they make excuses, counter with data
- if they're being dramatic, match their drama then pivot
- if something seems genuinely stressful (debt panic, job loss), drop the sass and be direct

example exchanges (use as inspiration, not templates):
user: "that was future me's problem"
assistant: "it's 8am. you are future you now."
user: "i hate her"
assistant: "i hate you too"

user: "i have groceries at home"
assistant: "i know. you spent $156 on groceries too"
user: "they go bad before i eat them"
assistant: "because you keep ordering doordash"
user: "okay therapist"
assistant: "someone has to be"

user: "that can't be right" (about 9 starbucks transactions)
assistant: "there are only 7 days in a week"

user: "no i don't???" (about subscriptions)
assistant: "want me to list them?"
user: "...no"
assistant: "that's what i thought"`;

// Test scenarios with context
const TEST_CASES = [
  {
    name: 'Balance request',
    context: 'User has $2,340 in checking, $890 in savings, $1,200 owed on credit card',
    userMessage: "what's my balance",
  },
  {
    name: 'Spending denial',
    context: 'User spent $340 at Target this week, $89 at Starbucks (7 transactions)',
    userMessage: "i haven't been spending that much",
  },
  {
    name: 'Future me excuse',
    context: 'User asking about their $500 impulse purchase at 8am',
    userMessage: "that was future me's problem",
  },
  {
    name: 'Subscription denial',
    context: 'User has 12 active subscriptions totaling $187/month',
    userMessage: "i don't have that many subscriptions",
  },
  {
    name: 'Stressed about money',
    context: 'User has $43 in checking, next paycheck in 5 days, $2,100 credit card debt',
    userMessage: "i'm kind of freaking out about money",
  },
  {
    name: 'Repeat offender',
    context: 'User has returned and re-purchased at Zara 4 times this month',
    userMessage: "i'm being responsible, i returned some stuff",
  },
  {
    name: 'Groceries excuse',
    context: 'User spent $156 on groceries AND $89 on DoorDash this week',
    userMessage: "i have groceries at home",
  },
  {
    name: 'Casual greeting',
    context: 'No specific financial context',
    userMessage: "hey",
  },
];

async function callLLM(systemPrompt: string, context: string, userMessage: string): Promise<string> {
  const fullSystem = `${systemPrompt}\n\nCONTEXT FOR THIS RESPONSE:\n${context}`;
  
  const res = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${OPENAI_API_KEY}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model: MODEL,
      messages: [
        { role: 'system', content: fullSystem },
        { role: 'user', content: userMessage },
      ],
      max_tokens: 150,
      temperature: 0.7,
    }),
  });

  if (!res.ok) {
    const err = await res.text();
    throw new Error(`OpenAI error: ${res.status} - ${err}`);
  }

  const data = await res.json();
  return data.choices?.[0]?.message?.content?.trim() ?? '(no response)';
}

async function runComparison() {
  console.log('='.repeat(80));
  console.log('PROMPT COMPARISON: OLD vs NEW');
  console.log('='.repeat(80));
  console.log();

  for (const testCase of TEST_CASES) {
    console.log(`\n${'─'.repeat(80)}`);
    console.log(`TEST: ${testCase.name}`);
    console.log(`Context: ${testCase.context}`);
    console.log(`User: "${testCase.userMessage}"`);
    console.log('─'.repeat(80));

    try {
      const [oldResponse, newResponse] = await Promise.all([
        callLLM(OLD_PROMPT, testCase.context, testCase.userMessage),
        callLLM(NEW_PROMPT, testCase.context, testCase.userMessage),
      ]);

      console.log(`\nOLD: ${oldResponse}`);
      console.log(`NEW: ${newResponse}`);
      
      // Simple analysis
      const oldLen = oldResponse.length;
      const newLen = newResponse.length;
      const hasEmoji = (s: string) => /[\u{1F300}-\u{1F9FF}]/u.test(s);
      
      console.log(`\n[Length: old=${oldLen}, new=${newLen}] [Emoji: old=${hasEmoji(oldResponse)}, new=${hasEmoji(newResponse)}]`);
    } catch (err) {
      console.error(`Error: ${err}`);
    }

    // Small delay to avoid rate limits
    await new Promise(r => setTimeout(r, 200));
  }

  console.log('\n' + '='.repeat(80));
  console.log('COMPARISON COMPLETE');
  console.log('='.repeat(80));
}

runComparison().catch(console.error);
