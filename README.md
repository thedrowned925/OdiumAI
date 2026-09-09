# OdiumAI

OdiumAI is a focused AI workspace built around fast everyday chat, deeper reasoning modes, and transparent usage allowances.

## Basic milestone

This branch makes the first real model route usable:

- Dark-first interface, including browser color scheme
- Three visible modes: Basic, Thinking, and Ultra Thinking
- Basic enabled with Gemini 3.6 Flash
- Thinking and Ultra Thinking visible but locked as Coming soon
- Token-by-token answer streaming from Gemini into Odium
- Provider-exposed Gemini thought summaries can stream into Odium's thinking UI
- Conversation history is forwarded with each Basic request
- Gemini credentials stay on the backend and are never shipped in Vite/browser code
- Lightweight per-IP request limiting on the included backend

The request path is:

```text
Browser -> Odium backend -> Gemini API -> streamed Odium events -> Browser
```

The consumer Gemini website session/cookies are not used. Odium talks to the official Gemini Developer API with a backend-only API key.

## Run locally

1. Install dependencies:

```bash
npm install
```

2. Copy the environment template:

```bash
cp .env.example .env
```

3. Put your Google AI Studio key in `.env`:

```dotenv
GEMINI_API_KEY=your_real_key
GEMINI_MODEL=gemini-3.6-flash
VITE_ODIUM_API_BASE_URL=http://localhost:8787
```

4. Start the backend:

```bash
npm run server
```

5. In a second terminal, start Vite:

```bash
npm run dev
```

Open the Vite URL. In **Providers & settings**, the Gemini status should become **Connected** when the backend can access the configured model.

## Production notes

Never put `GEMINI_API_KEY` in a `VITE_*` variable, committed file, or frontend bundle. Deploy `server/index.js` on a Node 20+ backend and set its environment variables there. Point the static Odium frontend at that service with `VITE_ODIUM_API_BASE_URL` or through the Providers settings UI.

For the included GitHub Pages workflow, create a repository Actions variable named `VITE_ODIUM_API_BASE_URL` whose value is the public HTTPS URL of the deployed Odium backend. The Pages build injects only that public URL; the Gemini API key must remain on the backend host.

Set `ODIUM_ALLOWED_ORIGINS` to the browser origins that are allowed to call your backend. `ODIUM_REQUESTS_PER_MINUTE` controls the simple in-process rate limit; a public deployment should eventually add persistent rate limiting and user authentication before serving large traffic.

## API contract

The included backend exposes:

- `GET /api/providers/gemini/status`
- `POST /api/providers/gemini/stream`

The streaming endpoint returns SSE events understood by `src/providers/geminiProvider.js`, including `answer`, optional `reasoning`, `usage`, and `done` events.

## Build

```bash
npm run build
npm run preview
```

## Next

Thinking and Ultra Thinking intentionally remain disabled until their separate routing and reasoning policies are implemented.
