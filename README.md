# OdiumAI

OdiumAI is a focused AI workspace built around fast everyday chat, deeper reasoning modes, and transparent usage allowances.

## Current prototype

The first frontend pass includes:

- Premium dark desktop-first chat interface
- Collapsible conversation sidebar
- Basic, Thinking, and Ultra Thinking mode selector
- Five-hour and weekly usage meters
- File / reasoning / visual quick actions
- Responsive prompt composer
- Mobile and tablet layouts

## Run locally

```bash
npm install
npm run dev
```

Then open the local Vite URL shown in the terminal.

## Build

```bash
npm run build
npm run preview
```

## Direction

The UI is intentionally provider-agnostic. Model routing, authentication, usage accounting, persistence, and agent/tool execution will be added behind separate service interfaces so the product shell does not depend on one backend implementation.
