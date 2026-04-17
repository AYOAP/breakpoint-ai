# BREAKPOINT AI

BREAKPOINT AI is a structured venture evaluation system for founders, operators, and investors.

It is designed to pressure test startup ideas, business models, and investment theses through a defined system:

DEFINE → CLARIFY → APPLY PRESSURE → BREAK → LEARN

This is not a chatbot.  
It is not designed to validate ideas.  
It is built to expose where ideas fail.

---

## ⚠️ Before You Run This

This project **requires your own OpenAI API key**.

It will NOT work without it.

Create a `.env.local` file and add:

OPENAI_API_KEY=your_key_here  
OPENAI_MODEL=gpt-5-mini  
BREAKPOINT_DAILY_API_LIMIT=100  

Important:
- `.env.local` is NOT included in this repo
- Never commit your API key
- The app will throw an error if the key is missing

---

## Development Note (Transparency)

This project was built using **AI-assisted development tools (Codex and similar)**.

However:
- The **product concept, system design, and evaluation framework** were designed and directed by me
- AI was used as an **execution accelerator**, not as the source of the idea or logic
- All core flows (DEFINE → CLARIFY → PRESSURE → BREAK) were intentionally structured and iterated

This project represents:
- product thinking
- system design
- AI-assisted engineering workflows

---

## What It Does

The app takes a venture idea and returns a structured breakdown:

- Venture Summary  
- Verdict  
- Core Break Point  
- Structural Weaknesses  
- Failure Scenarios  
- Kill Conditions  
- Proof Required Before Launch  
- Hidden Assumptions  
- Strengthening Moves  

---

## Stack

- Next.js App Router  
- TypeScript  
- Tailwind CSS  
- Framer Motion  
- OpenAI SDK  

---

## Local Setup

1. Install dependencies:

npm install

2. Copy environment template:

cp .env.example .env.local

3. Add your API key inside `.env.local`:

OPENAI_API_KEY=your_key_here  

(Optional)

OPENAI_MODEL=gpt-5-mini  
BREAKPOINT_DAILY_API_LIMIT=100  

4. Run the app:

npm run dev

5. Open:

http://localhost:3000

---

## Deploy (Recommended)

Use **Render** for this MVP.

Why:
- The app uses an in-memory daily API limit
- Works best on a single-instance server

### Steps:

1. Push repo to GitHub  
2. Create a new Render Web Service  
3. Add environment variables:
   - OPENAI_API_KEY  
   - OPENAI_MODEL=gpt-5-mini  
   - BREAKPOINT_DAILY_API_LIMIT=100  
4. Deploy  

Expected URL:

https://getbreakpoint.onrender.com

---

## Common Issues

App does not work or shows API error  
→ You did not set OPENAI_API_KEY  

Works locally but not in production  
→ Environment variables are missing in Render  

---

## Notes

- No database required  
- All API usage is server-side  
- Daily usage is capped (default: 100 calls/day)  
- This is an MVP prototype  

---

## Disclaimer

This system is for **venture evaluation only**.

It does NOT provide:
- legal advice  
- financial advice  
- investment recommendations  

Use qualified professionals where appropriate.
