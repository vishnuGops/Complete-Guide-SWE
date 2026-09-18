# DevProMax

DevProMax is a local-first, LeetCode-style training app for DSA interview prep in Python and Java, with an on-demand LLM coach (the AI Help button) that reviews the code written so far.

Status: the loop works end to end — 20 validated problems, a local judge for Python and Java, the API, a web UI where you can open a problem, write a solution and submit it, and the coach streaming rubric feedback with a user-supplied Anthropic or Gemini key (set `COACH_API_KEY` until the Settings screen gains the field). The audit-fix block, the learning features and the full 200-problem catalogue are next (see ROADMAP.md).

```
npm install
npm run dev      # web on 127.0.0.1:5173, server on 127.0.0.1:5174
```

- [ROADMAP.md](ROADMAP.md) — goals, architecture decisions, prioritised task table, milestones
- [CLAUDE.md](CLAUDE.md) — conventions and working agreement for development
- [temp/](temp/) — archived legacy content from the previous version of this repo (not used by the app)
