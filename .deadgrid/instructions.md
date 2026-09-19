# DEADGRID execution contract

The `.deadgrid` harness is authoritative for this repository. It injects the active task brief and enforces its file and context budgets.

- Start implementation after at most six targeted source reads. Do not conduct a repository takeover or architecture audit.
- Never recursively enumerate the repository, read `prompt.md`/`important.md`, or repeat a read/search/command that already failed to add information.
- Treat every `DEADGRID HARNESS BLOCKED` result as a final decision for that attempt. Do not retry the same read with a smaller limit, shifted offset, overlapping range, or cosmetically changed arguments. On `LOOP DETECTED`, stop tool use for the current response; the harness aborts that response.
- A root task file such as `1.md` may be read once. The harness reclassifies the task from that file's contents. It does not consume source reconnaissance budget, but it must not be reread.
- Read `.deadgrid/runtime/session-context.md` once after the task prompt. It contains the relevant architecture, locks, issues, campaign state, handoff, allowlists, budgets, and checkpoint policy.
- Do not read individual `.deadgrid` JSON files. They are internal harness state and do not consume source reconnaissance when denied.
- A genuinely different successful action resets consecutive blocked escalation. Successful reads never increment the blocked-attempt counter.
- For a configured large file, one overview read may be followed by materially different targeted ranges; the overview does not make every narrower range a retry.
- Stay inside the active task's read and edit allowlists. If an exact required file is blocked, explain why it is needed; the human can deliberately change the task scope.
- Preserve locked working systems and decisions unless the active task explicitly targets that domain.
- Work in small slices: targeted read, real source edit, typecheck, next slice. The harness runs additional checkpoints automatically.
- For BUGFIX and campaign/LEVEL_DESIGN tasks, reaching the pre-edit inspection threshold is an edit milestone: make the first implementation edit instead of continuing to inspect.
- Do not use Puppeteer, Qwen-VL, or screenshot loops to judge the game. Record visual, pacing, navigation, lighting, and feel checks for human QA.
- Do not claim visual or gameplay acceptance from automated checks. A passing typecheck/build means the code is mechanically healthy, not that the game looks or feels right.
- Finish with a concise account of edits, automated checkpoints, pending human QA, and the next concrete step. The harness writes the structured handoff.
