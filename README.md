# BREAKPOINT AI

BREAKPOINT AI is a structured venture evaluation system for founders, operators, and investors. It is built for startup ideas, venture concepts, business models, pricing bets, launch plans, operating decisions, and investment theses. It does not validate ideas, act like a chatbot, or provide open-ended conversation. It forces a venture through a defined process:

`DEFINE → CLARIFY → APPLY PRESSURE → BREAK → LEARN`

The app accepts a venture idea, calibrates the founder stage, generates a small set of high-leverage clarification questions, then returns a structured founder-and-investor-focused evaluation:

- Venture Summary
- Verdict
- Core Break Point
- Structural Weaknesses
- Failure Scenarios
- Kill Conditions
- Proof Required Before Launch
- Hidden Assumptions
- Strengthening Moves

## Stack

- Next.js App Router
- TypeScript
- Tailwind CSS
- shadcn/ui-style component system
- Framer Motion
- Lucide Icons
- OpenAI SDK

## Local Setup

1. Install dependencies:

```bash
npm install
```

2. Copy the environment template:

```bash
cp .env.example .env.local
```

3. Add your OpenAI API key in `.env.local`:

```bash
OPENAI_API_KEY=your_openai_api_key_here
OPENAI_MODEL=gpt-5-mini
BREAKPOINT_DAILY_API_LIMIT=100
```

`OPENAI_MODEL` is optional. The app defaults to `gpt-5-mini`.
`BREAKPOINT_DAILY_API_LIMIT` is optional. The app defaults to `100` total API calls per day across the whole site.

4. Start the development server:

```bash
npm run dev
```

5. Open [http://localhost:3000](http://localhost:3000)

## How It Works

### `/api/clarify`

- Accepts the submitted idea
- Accepts the submitted idea, founder stage, and optional context note
- Generates 2 to 5 high-impact clarification questions
- Calibrates question difficulty and vocabulary to the founder stage
- Returns structured JSON

### `/api/analyze`

- Accepts the idea plus clarification answers
- Generates a structured venture evaluation
- Returns strict JSON in this shape:

```json
{
  "venture_summary": "string",
  "invincibility_score": 0,
  "verdict": "string",
  "core_break_point": "string",
  "structural_weak_points": [],
  "failure_scenarios": [],
  "kill_conditions": [],
  "proof_required_before_launch": [],
  "hidden_assumptions": [],
  "strengthening_moves": []
}
```

## Production Build

Run a production build locally:

```bash
npm run build
```

Start the production server:

```bash
npm run start
```

## Deploy

### Recommended for this MVP: Render or Railway

For this build, a **single-instance Node host** is the cleanest option because the testing cap is stored in server memory. That means the `100 calls/day` limit behaves predictably on a single running app instance.

This repo now includes [`render.yaml`](</Users/aps/Downloads/BREAKPOINT AI/render.yaml>) so Render can pick up the right commands automatically.

Fastest path:

1. Put this project in a GitHub repo
2. Create a new Render Web Service from that repo
3. Render should detect `render.yaml`
4. Add these environment variables:
   - `OPENAI_API_KEY`
   - `OPENAI_MODEL=gpt-5-mini`
   - `BREAKPOINT_DAILY_API_LIMIT=100`
5. Deploy

Your share link will look like:

- `https://getbreakpoint.onrender.com`

You can later attach a custom domain if you want a shorter/snappier link.

### Vercel

1. Push this project to GitHub
2. Import the repo into Vercel
3. Add the environment variables:
   - `OPENAI_API_KEY`
   - `OPENAI_MODEL` (optional)
   - `BREAKPOINT_DAILY_API_LIMIT=100`
4. Deploy

Important note:

- Vercel is great for hosting Next.js, but the built-in daily API cap in this MVP is **best-effort only** there, because serverless runtimes do not guarantee one shared in-memory counter across all invocations.
- If you want the `100/day` cap to be strict on Vercel, the next step would be adding a tiny external store such as Upstash Redis.

### Other platforms

Any platform that supports Next.js server routes works. Add the same environment variables and run:

```bash
npm run build
npm run start
```

## Notes

- No database is required
- All state is client-side for the session
- The OpenAI key is used only from server-side API routes
- The daily testing cap is global for the app instance and defaults to `100` API calls per day
- If the model returns malformed output or the key is missing, the UI surfaces the error state directly
- The system is intended for venture idea stress testing and is not a substitute for legal or financial advice
