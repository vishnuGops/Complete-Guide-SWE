# Testing AI Help with a real API key

Every coach test that runs in CI replays a recorded stream. That proves the app
handles a response correctly; it cannot prove that a vendor accepts the request
the app builds. The only thing that can is a real key. This is the procedure for
the first time a key goes in, and for any time the coach's request changes: a
prompt version bump, a new model, an SDK upgrade.

It is written for Anthropic, the default provider. Gemini works the same way
with `GEMINI_API_KEY` in step 1 and a Gemini key in step 2.

It costs real money, a little. Every figure below is an estimate from list
prices; your provider's usage page is the only true record.

---

## Before you start

1. **Give the key a ceiling at the vendor.** In the Anthropic Console, create
   the key in a workspace with a monthly spend limit (ten dollars is plenty for
   practice). The app has a cap of its own (step 2), but it is per conversation
   and off by default; the Console limit is the one nothing in this app can get
   around.
2. **Optional: take a backup** with `npm run db:backup`. Nothing here should
   touch your practice data, but it costs nothing. A backup leaves the key out
   unless you pass `--include-key`.
3. **Know where the key goes.** In step 1 it lives only in your terminal
   session. In step 2 it is stored in plain text in `data/devpromax.db` on this
   machine (ROADMAP D19), shown masked in Settings, never logged, never returned
   by the API and never written to a backup. A request goes to the provider you
   chose and nowhere else.

---

## Step 1: prove the request against the real API

This runs the opt-in live suite, `apps/server/src/coach/live.integration.test.ts`,
straight against the vendor. The app is not running and the key is not stored:
it is read from an environment variable for this one command.

Run it in two parts, cheapest first, so a request the API refuses costs you
cents rather than a dollar.

**PowerShell.** Read the key without echoing it, so it lands in neither the
screen nor the shell history:

```powershell
$secure = Read-Host 'Anthropic API key' -AsSecureString
$env:ANTHROPIC_API_KEY = [Runtime.InteropServices.Marshal]::PtrToStringAuto(
  [Runtime.InteropServices.Marshal]::SecureStringToBSTR($secure))
$env:COACH_LIVE_TESTS = '1'
```

**Part A: the request is accepted.** A review, a cancelled review, a follow-up
and an interviewer turn on the default model (`claude-opus-5`), plus one review
on Haiku 4.5, the model that takes neither adaptive thinking nor `effort`.
About $0.25.

```powershell
npx vitest run --project server-integration apps/server/src/coach/live.integration.test.ts -t "live vendor|Haiku"
```

**Part B: the prompt behaves.** Six fixed attempts, from an untouched starter to
a clean solution, each of which must score where the rubric ladder says. Run
this only once Part A is green, and again whenever the prompt changes. About
$0.75.

```powershell
npx vitest run --project server-integration apps/server/src/coach/live.integration.test.ts -t "rubric fixtures"
```

**Then clear the variables**, so the key does not outlive the check:

```powershell
Remove-Item Env:ANTHROPIC_API_KEY, Env:COACH_LIVE_TESTS
```

In bash the same run is
`COACH_LIVE_TESTS=1 ANTHROPIC_API_KEY=... npx vitest run --project server-integration apps/server/src/coach/live.integration.test.ts -t "live vendor|Haiku"`.
A key typed on a bash command line is saved in `~/.bash_history`; prefix the
command with a space only if `HISTCONTROL` ignores those, or export it with
`read -rs ANTHROPIC_API_KEY && export ANTHROPIC_API_KEY` first.

Without `COACH_LIVE_TESTS=1` every test in the file is skipped, and with it but
no key, the tests for that provider are skipped. A run that reports only skips
has not checked anything.

**What a failure means:**

| Failure                                             | Meaning                                                                                                                                                                                                    |
| --------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `401` / "rejected the key"                          | The key is wrong, revoked, or from another vendor.                                                                                                                                                         |
| `400` with the vendor's own message                 | The app sent something the API refuses. This is the failure the suite exists to catch: fix the request (`apps/server/src/coach/anthropic.ts`) before putting the key in the app.                           |
| `404` "no model called …"                           | The model id is not one this key can use.                                                                                                                                                                  |
| `429` or "overloaded"                               | The vendor is busy or your rate limit is low. Wait and run again; it is not a bug.                                                                                                                         |
| A rubric case scores outside its band (Part B only) | The request works but the prompt no longer grades the way the ladder says. Look at the case's output before changing anything, and see [COACH_PROMPTS.md](COACH_PROMPTS.md) for how prompts are versioned. |

---

## Step 2: put the key in the app

1. Start the app: `npm start` (built, one process on `127.0.0.1:5174`), or
   `npm run dev` while working on it.
2. Open **Settings › AI coach**.
3. **Provider:** Anthropic. **API key:** paste it and save. The field clears
   once the server has confirmed the save, and the key then shows only masked.
4. **Model:** leave it empty for `claude-opus-5`, the default. `claude-sonnet-5`
   costs about 40% as much per token and is a reasonable everyday choice;
   `claude-haiku-4-5` is cheapest and reviews without thinking.
5. **Spend cap per conversation:** set one, for example `0.50`. A conversation
   is everything the coach has said about one problem in one language, until
   you start a new conversation from the Coach panel; the cap starts again with
   each new one. It is checked before a turn against what the conversation has
   already spent, so the turn that crosses it still goes ahead: with a $0.50
   cap the bill stops somewhere a little past fifty cents, never at five
   dollars. It does not bound a whole evening across many problems - the
   Console limit does that.
6. **Test connection.** It lists the provider's models, which costs nothing, and
   should say it is connected.

Instead of storing the key, you can set `COACH_API_KEY` in the environment the
server starts in; it overrides the stored one and is never written to the
database.

---

## Step 3: check it by hand

Open one problem you have not solved (a pair-sum style Easy is quickest) and
work down the list. Every step should behave as described; anything else is a
bug worth writing down with what you saw.

| #   | Do                                                                                                                          | Expect                                                                                                                                                      |
| --- | --------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 1   | With the untouched starter, press **AI Help**.                                                                              | Refused on this machine with a note to write something first. No request is made and nothing is spent.                                                      |
| 2   | Look at the estimate beside AI Help once there is code.                                                                     | A figure of a few cents on Opus 5 (about $0.10-0.15 per review), less on Sonnet or Haiku.                                                                   |
| 3   | Write a partial or wrong solution, **Run** it, then **AI Help**.                                                            | The review streams into the Coach panel: five rubric scores, a hint at the lowest useful rung, and a mention of what the Run just showed. No full solution. |
| 4   | Ask a follow-up question in the box under the review, and send it with `Ctrl+Enter`.                                        | A short answer in prose. No JSON and no scores. `Ctrl+Enter` sends the question; it does not run your code.                                                 |
| 5   | Press AI Help again and **Stop** part-way through.                                                                          | The answer stops at once and the partial text stays. The turn is still counted towards the cap.                                                             |
| 6   | Ask the coach to just give you the solution.                                                                                | It declines: a full solution is only for a problem already solved, when you ask for one.                                                                    |
| 7   | **Submit** a correct solution, then use the coach's mastery check.                                                          | A strong solution can move the problem to **Mastered**. The status updates on screen and in the list without a reload.                                      |
| 8   | With steps 3-5 behind you (so this conversation has spent more than a cent), set the spend cap to `0.01` and press AI Help. | Refused with a message about the cap, before any request is made. Starting a new conversation clears it. Set the cap back afterwards.                       |
| 9   | Set the model to `claude-nope` and press AI Help.                                                                           | An error naming the model that does not exist. Clear the model field afterwards.                                                                            |
| 10  | Start a **mock interview**, explain an approach, open the problem to code it, then come back.                               | The interviewer asks rather than tells, and the conversation is still there when you return. Ending it writes a debrief.                                    |

Then compare with the Anthropic Console's usage page. Steps 1 and 3 together
should come to a few dollars at most. The estimate beside AI Help is meant to be
a little pessimistic; if the Console shows much more than it predicted, that is
worth reporting.

---

## When something goes wrong in the app

| You see                                              | It means                                                                 | Do                                                                                              |
| ---------------------------------------------------- | ------------------------------------------------------------------------ | ----------------------------------------------------------------------------------------------- |
| "Rejected the key" or similar                        | Wrong, revoked or other-vendor key. Keys are per vendor.                 | Paste the right key in Settings; check the provider matches the key.                            |
| The vendor's own message after "refused the request" | A request the API does not accept.                                       | Run step 1 to reproduce it outside the app, and report the message. It never contains your key. |
| "Overloaded" or "rate limited", with **Try again**   | The vendor is busy.                                                      | Try again in a moment.                                                                          |
| "The model declined this request"                    | A refusal. Retrying sends the same request.                              | Rephrase the question, or start a new conversation.                                             |
| "The answer was cut off"                             | The stream ended without finishing (a network drop, or 90 s of silence). | Try again. The partial answer is kept.                                                          |
| The cap message                                      | This conversation reached its spend cap.                                 | Start a new conversation, or raise the cap in Settings.                                         |

The server's log never contains the key, so it is safe to paste into a bug
report.

---

## Afterwards

- **To remove the key**, use **Settings › AI coach › Clear key**, or unset
  `COACH_API_KEY`. Revoke it in the Console if it was only for this test.
- **Record the run** in `CHANGELOG.md` under the day, with the model, the
  prompt version and whether both parts of step 1 passed. Until the first
  record, the live suite has never been run against the real API (ROADMAP
  M5.1).
- **Run step 1 again** whenever the prompt version changes, a new model is added
  to the price table, or `@anthropic-ai/sdk` is upgraded.
