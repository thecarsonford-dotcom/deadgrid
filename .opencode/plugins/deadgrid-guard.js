import fs from "node:fs"
import path from "node:path"
import { spawnSync } from "node:child_process"

const SOURCE_EXTENSIONS = new Set([".ts", ".tsx", ".js", ".mjs", ".cjs", ".css", ".html", ".json"])
const EDIT_TOOLS = new Set(["edit", "write", "patch", "apply_patch", "multiedit"])
const READ_TOOLS = new Set(["read", "file_read"])
const SEARCH_TOOLS = new Set(["grep", "glob", "search", "files", "find"])
const FOLLOW_UP_ONLY = /^(continue|go on|keep going|yes|yep|do it|proceed|resume|finish it|fix it)[.!\s]*$/i
const SESSION_CONTEXT_FILE = ".deadgrid/runtime/session-context.md"

function readJson(file, fallback) {
  try {
    return JSON.parse(fs.readFileSync(file, "utf8"))
  } catch {
    return fallback
  }
}

function writeJson(file, value) {
  fs.mkdirSync(path.dirname(file), { recursive: true })
  fs.writeFileSync(file, `${JSON.stringify(value, null, 2)}\n`, "utf8")
}

function slash(value) {
  return String(value ?? "").replaceAll("\\", "/")
}

function relativePath(root, value) {
  if (!value) return null
  const raw = String(value)
  const absolute = path.isAbsolute(raw) ? path.resolve(raw) : path.resolve(root, raw)
  const relative = slash(path.relative(root, absolute))
  if (!relative || relative === ".") return ""
  if (relative === ".." || relative.startsWith("../")) return null
  return relative
}

function globRegex(pattern) {
  let source = ""
  const value = slash(pattern).toLowerCase()
  for (let index = 0; index < value.length; index += 1) {
    const char = value[index]
    if (char === "*" && value[index + 1] === "*" && value[index + 2] === "/") {
      source += "(?:.*/)?"
      index += 2
    } else if (char === "*" && value[index + 1] === "*") {
      source += ".*"
      index += 1
    } else if (char === "*") {
      source += "[^/]*"
    } else if (char === "?") {
      source += "[^/]"
    } else {
      source += char.replace(/[|\\{}()[\]^$+?.]/g, "\\$&")
    }
  }
  return new RegExp(`^${source}$`, "i")
}

function matchesAny(file, patterns) {
  const normalized = slash(file).toLowerCase()
  return patterns.some((pattern) => globRegex(pattern).test(normalized))
}

function extractText(parts) {
  return (parts ?? [])
    .filter((part) => part && (part.type === "text" || typeof part.text === "string"))
    .map((part) => part.text ?? "")
    .join("\n")
    .trim()
}

function mentionedFiles(text) {
  const matches = text.match(/(?:src|tools)\/[A-Za-z0-9_./-]+\.(?:ts|tsx|js|mjs|cjs|json|css|html)/gi) ?? []
  return [...new Set(matches.map((item) => slash(item).replace(/[),.;:'"`]+$/g, "")))]
}

function classify(text, policy) {
  const normalized = text.toLowerCase()
  if (/\b(release|regression|typecheck|production build|verify build|qa pass)\b/.test(normalized)) return "RELEASE_QA"
  if (/\b(viewmodel|gun model|weapon model|ads|recoil|muzzle|sleeves|gloves)\b/.test(normalized)) return "VIEWMODEL"
  if (/\b(minimap|compass|waypoint|objective marker|navigation)\b/.test(normalized)) return "NAVIGATION"
  if (/\b(audio|sound|music|sfx|radio cue)\b/.test(normalized)) return "AUDIO"
  if (/\b(asset|manifest|registry|normalization|orientation)\b/.test(normalized)) return "ASSETS"
  if (/\b(bug|broken|crash|regression|doesn't|does not work|wrong)\b/.test(normalized)) return "BUGFIX"

  let best = "GENERAL"
  let bestScore = 0
  for (const [mode, config] of Object.entries(policy.modes ?? {})) {
    if (["GENERAL", "BUGFIX", "RELEASE_QA", "VIEWMODEL", "NAVIGATION", "AUDIO", "ASSETS"].includes(mode)) continue
    const score = (config.keywords ?? []).reduce((total, keyword) => total + (normalized.includes(keyword.toLowerCase()) ? 1 : 0), 0)
    if (score > bestScore) {
      best = mode
      bestScore = score
    }
  }
  return best
}

function buildTask(text, sessionID, policy) {
  const mode = classify(text, policy)
  const modePolicy = policy.modes?.[mode] ?? policy.modes.GENERAL
  const explicit = mentionedFiles(text)
  return {
    schemaVersion: 1,
    status: "active",
    mode,
    goal: text.replace(/\s+/g, " ").slice(0, 1000),
    allowedRead: [...new Set([...(modePolicy.allowedRead ?? []), ...explicit])],
    allowedEdit: [...new Set([...(modePolicy.allowedEdit ?? []), ...explicit])],
    budgets: { ...policy.defaults },
    humanQaRequired: Boolean(modePolicy.humanQaRequired),
    checkpoints: ["typecheck", "build"],
    sessionId: sessionID,
    updatedAt: new Date().toISOString(),
  }
}

function extractToolPaths(root, args) {
  const candidates = []
  for (const key of ["filePath", "path", "file", "filename", "target", "directory"]) {
    if (typeof args?.[key] === "string") candidates.push(args[key])
  }
  if (typeof args?.patchText === "string") {
    for (const match of args.patchText.matchAll(/^\*\*\* (?:Add|Update|Delete) File: (.+)$/gm)) candidates.push(match[1].trim())
  }
  if (Array.isArray(args?.files)) candidates.push(...args.files.filter((item) => typeof item === "string"))
  return [...new Set(candidates.map((item) => relativePath(root, item)).filter((item) => item !== null))]
}

function sourceFile(relative) {
  if (!relative || relative.startsWith(".deadgrid/") || relative.startsWith(".opencode/")) return false
  return SOURCE_EXTENSIONS.has(path.extname(relative).toLowerCase())
}

function taskPromptFile(relative) {
  if (!relative || relative.includes("/") || path.extname(relative).toLowerCase() !== ".md") return false
  return !/^(?:prompt|prompt2|important|importantprompt)\.md$/i.test(relative)
}

function sessionContextFile(relative) {
  return slash(relative).toLowerCase() === SESSION_CONTEXT_FILE
}

function harnessMetadataPath(relative) {
  const normalized = slash(relative).toLowerCase()
  return normalized === ".deadgrid" || (normalized.startsWith(".deadgrid/") && !sessionContextFile(normalized))
}

function integer(value, fallback) {
  const parsed = Number.parseInt(String(value ?? ""), 10)
  return Number.isFinite(parsed) ? parsed : fallback
}

function readRequest(file, args) {
  const start = Math.max(0, integer(args?.offset, 0))
  const limit = Math.max(1, integer(args?.limit, 2000))
  return { file, start, end: start + limit, limit }
}

function overlapRatio(left, right) {
  if (!left || !right || left.file !== right.file) return 0
  const overlap = Math.max(0, Math.min(left.end, right.end) - Math.max(left.start, right.start))
  return overlap / Math.max(1, Math.min(left.limit, right.limit))
}

function substantiallySameRead(left, right, loopControl) {
  if (!left || !right || left.file !== right.file) return false
  const overlap = overlapRatio(left, right)
  const threshold = Number(loopControl.readOverlapThreshold ?? 0.8)
  const nearStartLines = Number(loopControl.nearStartLines ?? 8)
  return overlap >= threshold || (Math.abs(left.start - right.start) <= nearStartLines && overlap >= 0.65)
}

function readKind(file, range, largeFiles, loopControl) {
  const overviewMinimum = Number(loopControl.overviewReadMinimumLines ?? 500)
  const targetedMaximum = Number(loopControl.targetedReadMaximumLines ?? 400)
  if (largeFiles.has(file) && range.limit >= overviewMinimum) return "overview"
  if (range.limit <= targetedMaximum) return "targeted"
  return "bounded"
}

function redundantRead(prior, current, loopControl) {
  // One broad overview is allowed to establish structure. It must not make later
  // precise implementation ranges look like retries merely because they overlap it.
  if (prior?.kind === "overview" && current?.kind === "targeted") return false
  return substantiallySameRead(prior, current, loopControl)
}

function estimateReadTokens(root, relative, args) {
  try {
    const content = fs.readFileSync(path.join(root, relative), "utf8")
    const lines = content.split(/\r?\n/)
    const offset = Math.max(0, Number(args?.offset ?? 0))
    const limit = Math.max(1, Number(args?.limit ?? 2000))
    return Math.ceil(lines.slice(offset, offset + limit).join("\n").length / 4)
  } catch {
    return 1000
  }
}

function commandFromArgs(args) {
  return String(args?.command ?? args?.cmd ?? args?.script ?? "").trim()
}

function stableValue(value) {
  if (Array.isArray(value)) return value.map(stableValue)
  if (value && typeof value === "object") {
    return Object.fromEntries(Object.keys(value).sort().map((key) => [key, stableValue(value[key])]))
  }
  return typeof value === "string" ? value.trim().replace(/\s+/g, " ").toLowerCase() : value
}

function normalizeSearchSignature(tool, args) {
  const query = args?.pattern ?? args?.query ?? args?.search ?? args?.text ?? args?.glob ?? ""
  const target = args?.path ?? args?.filePath ?? args?.file ?? args?.directory ?? args?.include ?? ""
  return `${tool}:${slash(query).trim().replace(/\s+/g, " ").toLowerCase()}:${slash(target).trim().toLowerCase()}`
}

function normalizeShellSignature(args) {
  return commandFromArgs(args)
    .toLowerCase()
    .replace(/["']/g, "")
    .replace(/\|\s*(?:select-object|select)\s+-(?:first|last)\s+\d+/g, "| select-object -first #")
    .replace(/\b(?:head|tail)\s+-n\s+\d+/g, "head -n #")
    .replace(/\s+/g, " ")
    .trim()
}

function normalizeSignature(tool, args, editEpoch) {
  const normalized = JSON.stringify(stableValue(args ?? {}))
  const checkpoint = tool === "bash" && /(?:npm(?:\.cmd)?\s+run\s+(?:typecheck|build)|tsc\b|vite\s+build)/i.test(commandFromArgs(args))
  return `${tool}:${normalized}${checkpoint ? `:edit-${editEpoch}` : ""}`
}

function blockedAttemptsSimilar(left, right, loopControl) {
  if (!left || !right) return false
  if (left.reason === "first-edit-milestone" && right.reason === "first-edit-milestone") return true
  if (left.reason === "repeated-task-prompt" && right.reason === "repeated-task-prompt") return left.file === right.file
  if (left.reason === "per-file-budget" && right.reason === "per-file-budget") return left.file === right.file
  if (/^(?:pre-edit|total-).*-budget$/.test(left.reason ?? "") && left.reason === right.reason) return true
  if (left.kind !== right.kind) return false
  if (left.kind === "read") return substantiallySameRead(left.range, right.range, loopControl)
  return left.signature === right.signature
}

function runCheck(root, name) {
  const command = name === "build" ? "npm run build" : "npm run typecheck"
  const startedAt = new Date().toISOString()
  const result = spawnSync(command, {
    cwd: root,
    encoding: "utf8",
    shell: true,
    windowsHide: true,
    timeout: name === "build" ? 180000 : 120000,
  })
  const combined = `${result.stdout ?? ""}\n${result.stderr ?? ""}`.trim()
  return {
    name,
    command,
    startedAt,
    finishedAt: new Date().toISOString(),
    passed: result.status === 0,
    exitCode: result.status,
    summary: combined.slice(-4000),
    timedOut: Boolean(result.error && result.error.code === "ETIMEDOUT"),
  }
}

function appendCheckpoint(root, checkpoint, sessionID, editCount) {
  const file = path.join(root, ".deadgrid", "checkpoints.json")
  const data = readJson(file, { schemaVersion: 1, runs: [] })
  data.runs = [...(data.runs ?? []), { sessionId: sessionID, editCount, ...checkpoint }].slice(-50)
  if (checkpoint.name === "final-regression") {
    data.schemaVersion = 2
    data.requirements = {
      finalRegression: ["typecheck", "build"],
      passPolicy: "all_required_checks_must_pass_for_the_same_edit_state",
      buildOnlyIsClean: false,
    }
    data.lastRegression = checkpoint
  }
  writeJson(file, data)
}

function evaluateFinalRegression(checkpoints, editCount) {
  const sameState = checkpoints.filter((item) => item.editCount === editCount)
  const typecheck = [...sameState].reverse().find((item) => item.name === "typecheck")
  const build = [...sameState].reverse().find((item) => item.name === "build")
  const typecheckPassed = typecheck?.passed === true
  const buildPassed = build?.passed === true
  const passed = typecheckPassed && buildPassed
  let reason = "Typecheck and production build both passed."
  if (!typecheck && !build) reason = "Final regression was not evaluated: typecheck and production build results are missing."
  else if (!typecheck) reason = "Final regression failed: a typecheck result is missing; a build-only pass is not clean."
  else if (!build) reason = "Final regression failed: a production-build result is missing."
  else if (!typecheckPassed && buildPassed) reason = "Production build passed, but final regression failed because typecheck failed."
  else if (typecheckPassed && !buildPassed) reason = "Typecheck passed, but final regression failed because the production build failed."
  else if (!typecheckPassed && !buildPassed) reason = "Final regression failed because typecheck and production build both failed."
  return {
    name: "final-regression",
    evaluatedAt: new Date().toISOString(),
    finishedAt: new Date().toISOString(),
    editCount,
    requiredChecks: ["typecheck", "build"],
    passPolicy: "all_required_checks_must_pass_for_the_same_edit_state",
    buildOnlyIsClean: false,
    typecheckPassed,
    buildPassed,
    passed,
    exitCode: passed ? 0 : 1,
    reason,
  }
}

function compactText(value, limit = 220) {
  return String(value ?? "").replace(/\s+/g, " ").trim().slice(0, limit)
}

function relevantArchitecture(architecture, task) {
  return Object.entries(architecture.domains ?? {})
    .map(([domain, files]) => ({
      domain,
      files: (files ?? []).filter((file) => matchesAny(file, task.allowedRead)),
    }))
    .filter((entry) => entry.files.length)
}

function relevantIssues(issues, task) {
  const goal = task.goal.toLowerCase()
  const modeTerms = task.mode === "LEVEL_DESIGN"
    ? /campaign|route|road|forest|cabin|relay|world-layout|objective/
    : task.mode === "RELEASE_QA"
      ? /build|type|regression|external|ts\d+/
      : task.mode === "BUGFIX"
        ? /bug|broken|error|crash|external|ts\d+/
        : null
  const goalTerms = new Set(goal.match(/[a-z][a-z0-9_-]{3,}/g) ?? [])
  return (issues.issues ?? [])
    .filter((issue) => {
      const text = `${issue.id} ${issue.area} ${issue.summary}`.toLowerCase()
      return !modeTerms || modeTerms.test(text) || [...goalTerms].some((term) => text.includes(term))
    })
    .slice(0, 6)
}

function applicableLocks(locks, task) {
  const decisions = (locks.decisions ?? []).filter((item) => {
    if (item.status === "locked") return true
    return task.allowedRead.some((pattern) => slash(pattern).includes(slash(item.scope)))
      || task.allowedEdit.some((pattern) => slash(pattern).includes(slash(item.scope)))
  })
  const protectedFiles = (locks.protectedFiles ?? []).filter((item) =>
    matchesAny(item.path, task.allowedRead) || matchesAny(item.path, task.allowedEdit))
  return { decisions, protectedFiles }
}

function writeSessionContext(root, task, state, locks) {
  const stateDir = path.join(root, ".deadgrid")
  const architecture = readJson(path.join(stateDir, "architecture.json"), { domains: {}, largeFiles: {} })
  const knownIssues = readJson(path.join(stateDir, "known-issues.json"), { issues: [] })
  const campaign = readJson(path.join(stateDir, "campaign.json"), { criticalPath: [], designContract: [] })
  const lastSession = readJson(path.join(stateDir, "last-session.json"), {})
  const architectureRows = relevantArchitecture(architecture, task)
  const issues = relevantIssues(knownIssues, task)
  const lockSet = applicableLocks(locks, task)
  const budget = task.budgets
  const contextWindow = Number((readJson(path.join(stateDir, "policy.json"), {}).loopControl ?? {}).contextWindowTokens ?? 256000)
  const diagnosticPercent = Number((readJson(path.join(stateDir, "policy.json"), {}).loopControl ?? {}).firstEditDiagnosticPercent ?? 15)
  const lines = [
    "# DEADGRID session context",
    "",
    `Generated: ${new Date().toISOString()}`,
    `Mode: ${task.mode}`,
    `Goal: ${compactText(task.goal, 1000)}`,
    "",
    "## Working contract",
    "",
    "- Read this generated file once. Do not inspect individual `.deadgrid` JSON files; they are harness implementation details.",
    "- Use targeted source reads, then make the first implementation edit. A different successful action resets blocked-loop escalation.",
    "- Visual/gameplay acceptance is human QA; do not block on Puppeteer, screenshots, or Qwen-VL.",
    "",
    "## Relevant architecture",
    "",
    ...(architectureRows.length
      ? architectureRows.map((entry) => `- ${entry.domain}: ${entry.files.join(", ")}`)
      : ["- Use only the allowlisted files below."]),
    "",
    "## Applicable locks",
    "",
    ...lockSet.decisions.map((item) => `- ${item.scope}: ${compactText(item.reason)}`),
    ...lockSet.protectedFiles.map((item) => `- Protected file ${item.path}; allowed modes: ${(item.allowedModes ?? []).join(", ")}`),
    ...(lockSet.decisions.length || lockSet.protectedFiles.length ? [] : ["- No additional task-specific locks."]),
    "",
    "## Relevant known issues",
    "",
    ...(issues.length ? issues.map((item) => `- ${item.id} [${item.status}]: ${compactText(item.summary)}`) : ["- None relevant to this task."]),
  ]
  if (task.mode === "LEVEL_DESIGN") {
    lines.push(
      "",
      "## Campaign state",
      "",
      ...(campaign.criticalPath ?? []).map((item) => `- ${item.label}: ${item.status}`),
      ...(campaign.designContract ?? []).map((item) => `- Contract: ${compactText(item)}`),
    )
  }
  lines.push(
    "",
    "## Previous handoff",
    "",
    `- Status: ${lastSession.status ?? "none"}`,
    `- Changed files: ${(lastSession.changedFiles ?? []).join(", ") || "none"}`,
    `- Next step: ${compactText((lastSession.nextSteps ?? [])[0] ?? "none")}`,
    "",
    "## Allowlist and budgets",
    "",
    `- Read: ${task.allowedRead.join(", ")}`,
    `- Edit: ${task.allowedEdit.join(", ")}`,
    `- Before first edit: ${budget.sourceReadsBeforeFirstEdit} source reads, about ${budget.sourceTokensBeforeFirstEdit} estimated source tokens, ${budget.searchCallsBeforeFirstEdit ?? 4} searches.`,
    `- Total: ${budget.sourceReadsTotal} source reads and about ${budget.sourceTokensTotal} estimated source tokens.`,
    `- Progress: ${state.sourceReads} source reads, ${state.sourceTokens} estimated source tokens, ${state.searchCalls} searches, ${state.editCount} edits.`,
    `- Diagnostic target: first edit before about ${diagnosticPercent}% of the ${contextWindow}-token context window; this percentage is advisory, not an abort condition.`,
    "",
    "## Checkpoints",
    "",
    "- During work: typecheck after the configured edit interval.",
    "- Final regression: typecheck PASS and production build PASS at the same edit state.",
    "- A Vite build pass alone is not a clean regression checkpoint.",
    "",
  )
  const target = path.join(root, SESSION_CONTEXT_FILE)
  fs.mkdirSync(path.dirname(target), { recursive: true })
  fs.writeFileSync(target, `${lines.join("\n")}\n`, "utf8")
}

function taskSummary(task, state, locks, lastSession) {
  const remainingReads = Math.max(0, task.budgets.sourceReadsTotal - state.sourceReads)
  const remainingTokens = Math.max(0, task.budgets.sourceTokensTotal - state.sourceTokens)
  const protectedDecisions = (locks.decisions ?? []).map((item) => item.scope).slice(0, 5).join(", ")
  return `
 DEADGRID HARNESS — ACTIVE TASK
 MODE: ${task.mode}
 GOAL: ${task.goal}
 SESSION CONTEXT: Read ${SESSION_CONTEXT_FILE} once. Do not read individual .deadgrid JSON files; they are internal harness state.
READ ALLOWLIST: ${task.allowedRead.join(", ")}
EDIT ALLOWLIST: ${task.allowedEdit.join(", ")}
BUDGET LEFT: ${remainingReads} source reads; about ${remainingTokens} source tokens. Before first edit: max ${task.budgets.sourceReadsBeforeFirstEdit} reads / ${task.budgets.sourceTokensBeforeFirstEdit} tokens.
SESSION PROGRESS: ${state.editCount} successful edit tool calls; changed files: ${[...state.changedFiles].join(", ") || "none"}.
GUARD STATUS: ${state.consecutiveBlockedAttempts} consecutive blocked attempt(s); ${state.loopEscalated ? "the current response was aborted for a detected tool loop" : "no active loop escalation"}.
CURRENT DIRECTIVE: ${state.pendingDirective || "none"}.
LOCKED UNLESS EXPLICITLY TARGETED: ${protectedDecisions}.
LAST HANDOFF: ${lastSession.status ?? "none"}; changed ${lastSession.changedFiles?.join(", ") || "nothing"}.
EXECUTION: targeted read -> edit -> typecheck. Final regression is clean only when typecheck and production build both pass for the same edit state; build-only is never clean. No broad scans, repeated calls, prompt.md/important.md, Puppeteer, Qwen-VL, or screenshot loops. Visual/gameplay acceptance belongs in human QA.
`.trim()
}

function makeSession(task) {
  return {
    task,
    sourceReads: 0,
    sourceTokens: 0,
    searchCalls: 0,
    editCount: 0,
    editsAtLastAutoCheck: 0,
    lastFinalizedEditCount: 0,
    changedFiles: new Set(),
    perFileReads: new Map(),
    readRanges: new Map(),
    taskPromptReads: new Set(),
    sessionContextRead: false,
    signatures: new Set(),
    blockedAttempts: [],
    consecutiveBlockedAttempts: 0,
    loopEscalated: false,
    pendingDirective: null,
    contextDiagnosticEmitted: false,
    checkpoints: [],
    startedAt: new Date().toISOString(),
  }
}

function requiresFirstEdit(task, loopControl) {
  return (loopControl.forwardProgressModes ?? ["BUGFIX", "LEVEL_DESIGN"]).includes(task.mode)
}

function inspectionBudgetExhausted(state) {
  const budget = state.task.budgets
  return state.sourceReads >= budget.sourceReadsBeforeFirstEdit
    || state.sourceTokens >= budget.sourceTokensBeforeFirstEdit
    || state.searchCalls >= (budget.searchCallsBeforeFirstEdit ?? 4)
}

export const DeadgridGuard = async ({ client, directory }) => {
  const root = path.resolve(directory)
  const stateDir = path.join(root, ".deadgrid")
  if (!fs.existsSync(path.join(stateDir, "project.json"))) return {}

  const policy = readJson(path.join(stateDir, "policy.json"), { defaults: {}, modes: {} })
  const locks = readJson(path.join(stateDir, "locks.json"), { decisions: [], protectedFiles: [] })
  const architecture = readJson(path.join(stateDir, "architecture.json"), { largeFiles: {} })
  const largeFiles = new Set(Object.keys(architecture.largeFiles ?? {}).map((file) => slash(file).toLowerCase()))
  const loopControl = policy.loopControl ?? {}
  const sessions = new Map()

  function currentTask(sessionID) {
    const saved = readJson(path.join(stateDir, "task.json"), null)
    if (saved?.sessionId === sessionID && saved.status === "active") return saved
    return saved?.status === "active" ? saved : buildTask("Implement the requested DEADGRID change.", sessionID, policy)
  }

  function session(sessionID) {
    if (!sessions.has(sessionID)) sessions.set(sessionID, makeSession(currentTask(sessionID)))
    return sessions.get(sessionID)
  }

  function saveRuntime(sessionID, state) {
    writeJson(path.join(stateDir, "runtime", `${sessionID}.json`), {
      schemaVersion: 1,
      sessionId: sessionID,
      mode: state.task.mode,
      goal: state.task.goal,
      sourceReads: state.sourceReads,
      estimatedSourceTokens: state.sourceTokens,
      searchCalls: state.searchCalls,
      editCount: state.editCount,
      changedFiles: [...state.changedFiles],
      readRanges: Object.fromEntries([...state.readRanges].map(([file, ranges]) => [file, ranges])),
      taskPromptReads: [...state.taskPromptReads],
      sessionContextRead: state.sessionContextRead,
      blockedAttempts: state.blockedAttempts,
      consecutiveBlockedAttempts: state.consecutiveBlockedAttempts,
      loopEscalated: state.loopEscalated,
      pendingDirective: state.pendingDirective,
      contextDiagnosticEmitted: state.contextDiagnosticEmitted,
      checkpoints: state.checkpoints,
      updatedAt: new Date().toISOString(),
    })
  }

  function markAllowed(state) {
    state.consecutiveBlockedAttempts = 0
    state.loopEscalated = false
    state.pendingDirective = null
  }

  async function denyTool(input, state, details, message) {
    const attempt = {
      at: new Date().toISOString(),
      tool: input.tool.toLowerCase(),
      callID: input.callID,
      kind: details.kind,
      signature: details.signature,
      file: details.file,
      range: details.range,
      reason: details.reason,
      message,
    }
    const previous = state.blockedAttempts.at(-1)
    state.consecutiveBlockedAttempts += 1
    const threshold = Number(loopControl.blockedAttemptsBeforeAbort ?? 2)
    const isLoop = state.consecutiveBlockedAttempts >= threshold
      && blockedAttemptsSimilar(previous, attempt, loopControl)

    let directive = message
    if (isLoop) {
      const noun = details.kind === "shell" ? "command" : details.kind
      directive = `LOOP DETECTED. Stop source inspection. Do not invoke this ${noun} again. Use current context and make the next implementation action.`
      attempt.loopDetected = true
      if (!state.loopEscalated) {
        state.loopEscalated = true
        attempt.abortRequested = true
        attempt.abortSucceeded = null
      } else {
        attempt.abortRequested = false
        attempt.abortSucceeded = true
      }
    }

    state.pendingDirective = directive
    state.blockedAttempts = [...state.blockedAttempts, attempt].slice(-30)
    // Persist the decision before aborting. An abort can cancel the hook itself,
    // so post-abort-only telemetry is not reliable evidence.
    saveRuntime(input.sessionID, state)
    if (isLoop && attempt.abortRequested) {
      try {
        const result = await client?.session?.abort?.({
          path: { id: input.sessionID },
          query: { directory: root },
        })
        attempt.abortSucceeded = result?.data === true || result === true
      } catch (error) {
        attempt.abortSucceeded = false
        attempt.abortError = String(error?.message ?? error)
      }
      saveRuntime(input.sessionID, state)
    }
    const abortNote = isLoop
      ? attempt.abortSucceeded
        ? " The current model response has been aborted by the harness."
        : " The harness requested a session abort; OpenCode did not confirm it, so manual interruption may still be required."
      : ""
    throw new Error(`DEADGRID HARNESS BLOCKED: ${directive}${abortNote}`)
  }

  function finalize(sessionID, state, status = "response_complete") {
    if (state.editCount <= state.lastFinalizedEditCount && status === "response_complete") return
    if (state.editCount > state.editsAtLastAutoCheck) {
      const typecheck = { ...runCheck(root, "typecheck"), editCount: state.editCount }
      state.checkpoints.push(typecheck)
      appendCheckpoint(root, typecheck, sessionID, state.editCount)
      state.editsAtLastAutoCheck = state.editCount
    }
    if (state.editCount > state.lastFinalizedEditCount) {
      const build = { ...runCheck(root, "build"), editCount: state.editCount }
      state.checkpoints.push(build)
      appendCheckpoint(root, build, sessionID, state.editCount)
    }
    const finalRegression = evaluateFinalRegression(state.checkpoints, state.editCount)
    state.checkpoints.push(finalRegression)
    appendCheckpoint(root, finalRegression, sessionID, state.editCount)
    const failed = !finalRegression.passed
    const humanQa = state.task.humanQaRequired && state.changedFiles.size
      ? [{ status: "pending", scope: state.task.mode, files: [...state.changedFiles], reason: "Human must judge visual/gameplay quality in a real play session." }]
      : []
    writeJson(path.join(stateDir, "last-session.json"), {
      schemaVersion: 1,
      status: failed ? "needs_attention" : status,
      sessionId: sessionID,
      startedAt: state.startedAt,
      updatedAt: new Date().toISOString(),
      mode: state.task.mode,
      goal: state.task.goal,
      changedFiles: [...state.changedFiles],
      telemetry: {
        sourceReads: state.sourceReads,
        estimatedSourceTokens: state.sourceTokens,
        searchCalls: state.searchCalls,
        editCalls: state.editCount,
      },
      checkpoints: state.checkpoints.map(({ name, passed, exitCode, finishedAt }) => ({ name, passed, exitCode, finishedAt })),
      finalRegression,
      humanQa,
      nextSteps: failed
        ? [finalRegression.reason, "Fix the failing automated checkpoint before widening task scope."]
        : humanQa.length
          ? ["Run the changed slice in the game and record human QA in .deadgrid/qa-state.json."]
          : ["Continue only with the next explicit user task."],
    })
    if (humanQa.length) {
      const qaFile = path.join(stateDir, "qa-state.json")
      const qa = readJson(qaFile, { schemaVersion: 1, pendingHumanQa: [], completedHumanQa: [] })
      const id = `${sessionID}-${state.editCount}`
      if (!(qa.pendingHumanQa ?? []).some((item) => item.id === id)) {
        qa.pendingHumanQa = [...(qa.pendingHumanQa ?? []), { id, createdAt: new Date().toISOString(), ...humanQa[0] }]
      }
      writeJson(qaFile, qa)
    }
    state.lastFinalizedEditCount = state.editCount
    saveRuntime(sessionID, state)
  }

  return {
    "chat.message": async (input, output) => {
      const text = extractText(output.parts)
      if (!text || FOLLOW_UP_ONLY.test(text)) return
      const nextTask = buildTask(text, input.sessionID, policy)
      writeJson(path.join(stateDir, "task.json"), nextTask)
      const nextState = makeSession(nextTask)
      sessions.set(input.sessionID, nextState)
      writeSessionContext(root, nextTask, nextState, locks)
      saveRuntime(input.sessionID, nextState)
    },

    "experimental.chat.system.transform": async (input, output) => {
      if (!input.sessionID) return
      const state = session(input.sessionID)
      writeSessionContext(root, state.task, state, locks)
      const lastSession = readJson(path.join(stateDir, "last-session.json"), {})
      const combined = [...output.system, taskSummary(state.task, state, locks, lastSession)]
        .filter(Boolean)
        .join("\n\n")
      // Qwen3.8's llama.cpp chat template accepts exactly one leading system
      // message. OpenCode also requires this array to be mutated in place.
      output.system.splice(0, output.system.length, combined)
    },

    "experimental.session.compacting": async (input, output) => {
      const state = session(input.sessionID)
      output.context.push(taskSummary(state.task, state, locks, readJson(path.join(stateDir, "last-session.json"), {})))
    },

    "shell.env": async (_input, output) => {
      output.env.DEADGRID_HARNESS = "1"
      output.env.DEADGRID_ROOT = root
    },

    "tool.execute.before": async (input, output) => {
      const tool = input.tool.toLowerCase()
      const state = session(input.sessionID)
      const task = state.task
      const args = output.args ?? {}
      let signature = normalizeSignature(tool, args, state.editCount)
      let sourceRead = false

      if (READ_TOOLS.has(tool)) {
        const files = extractToolPaths(root, args)
        if (files.length !== 1 || !files[0]) {
          await denyTool(input, state, { kind: "read", signature, reason: "invalid-read-target" }, "READ DENIED. Reads must target one exact file, not a directory or the repository root. Do not retry the same request.")
        }
        const file = files[0]
        const range = readRequest(file, args)
        signature = `read:${file}:${range.start}-${range.end}`
        if (sessionContextFile(file)) {
          if (state.sessionContextRead) {
            await denyTool(input, state, { kind: "read", signature: "session-context", file, range, reason: "repeated-session-context" }, "SESSION CONTEXT READ DENIED. The generated session context was already read and remains in context. Do not reread it; continue with targeted source work.")
          }
          state.sessionContextRead = true
          state.signatures.add("session-context")
          markAllowed(state)
          saveRuntime(input.sessionID, state)
          return
        }
        if (harnessMetadataPath(file)) {
          await denyTool(input, state, { kind: "metadata", signature: `metadata:${file}`, file, range, reason: "internal-harness-metadata" }, `HARNESS METADATA READ DENIED. ${file || ".deadgrid"} is internal state. Read ${SESSION_CONTEXT_FILE} once instead; this denial does not consume source reconnaissance budget.`)
        }
        if (/^(?:prompt|prompt2|important|importantprompt)\.(?:md|disabled)/i.test(file)) {
          await denyTool(input, state, { kind: "read", signature, file, range, reason: "legacy-prompt" }, "READ DENIED. Legacy giant prompt files are outside the compact state system. Use the task prompt and structured DEADGRID state already in context.")
        }
        if (taskPromptFile(file)) {
          if (state.taskPromptReads.has(file)) {
            await denyTool(input, state, { kind: "read", signature: `task-prompt:${file}`, file, range, reason: "repeated-task-prompt" }, "TASK PROMPT READ DENIED. This task prompt was already read once and is already in context. Do not reread it; continue with implementation.")
          }
          state.taskPromptReads.add(file)
          state.signatures.add(`task-prompt:${file}`)
          markAllowed(state)
          saveRuntime(input.sessionID, state)
          return
        }
        if (sourceFile(file)) {
          sourceRead = true
          if (!matchesAny(file, task.allowedRead)) {
            await denyTool(input, state, { kind: "read", signature, file, range, reason: "outside-allowlist" }, `READ DENIED. ${file} is outside the ${task.mode} read allowlist. Change task scope explicitly if it is truly required; do not retry this read.`)
          }
          range.kind = readKind(file, range, largeFiles, loopControl)
          const priorRanges = state.readRanges.get(file) ?? []
          const overlapping = priorRanges.find((priorRange) => redundantRead(priorRange, range, loopControl))
          if (overlapping) {
            await denyTool(input, state, { kind: "read", signature, file, range, reason: "overlapping-source-read" }, "READ DENIED. You already have this source context. DO NOT retry this read, change only the limit, or request an overlapping range. Continue using existing context. Your next action should be an edit, a genuinely different precise missing range with justification, or a relevant test.")
          }
          if (!state.editCount && requiresFirstEdit(task, loopControl) && inspectionBudgetExhausted(state)) {
            await denyTool(input, state, { kind: "read", signature: `milestone:${file}`, file, range, reason: "first-edit-milestone" }, "INSPECTION BUDGET EXHAUSTED. Make the first implementation edit now using the context already collected.")
          }
          const prior = state.perFileReads.get(file) ?? 0
          const configuredLimit = state.editCount ? task.budgets.readsPerFileTotal : task.budgets.readsPerFileBeforeFirstEdit
          const perFileLimit = !state.editCount && largeFiles.has(file)
            ? Math.max(configuredLimit, Number(loopControl.largeFileReadsBeforeFirstEdit ?? 5))
            : configuredLimit
          if (prior >= perFileLimit) {
            await denyTool(input, state, { kind: "read", signature: `file-budget:${file}`, file, range, reason: "per-file-budget" }, `READ DENIED. ${file} has already been read ${prior} times. Do not retry with a slightly different range; edit from current context or request a genuinely new precise missing range after making progress.`)
          }
          const tokens = estimateReadTokens(root, file, args)
          if (!state.editCount && requiresFirstEdit(task, loopControl)
            && (state.sourceReads >= task.budgets.sourceReadsBeforeFirstEdit
              || state.sourceTokens + tokens > task.budgets.sourceTokensBeforeFirstEdit)) {
            await denyTool(input, state, { kind: "read", signature: `milestone:${file}`, file, range, reason: "first-edit-milestone" }, "INSPECTION BUDGET EXHAUSTED. Make the first implementation edit now using the context already collected.")
          }
          if (!state.editCount && state.sourceReads >= task.budgets.sourceReadsBeforeFirstEdit) {
            await denyTool(input, state, { kind: "read", signature: `pre-edit-budget:${file}`, file, range, reason: "pre-edit-read-budget" }, "READ DENIED. The pre-edit source-read budget is exhausted. Make an implementation edit using the context already collected.")
          }
          if (!state.editCount && state.sourceTokens + tokens > task.budgets.sourceTokensBeforeFirstEdit) {
            await denyTool(input, state, { kind: "read", signature: `pre-edit-token-budget:${file}`, file, range, reason: "pre-edit-token-budget" }, "READ DENIED. This request would exceed the pre-edit token budget. Make an implementation edit using the context already collected.")
          }
          if (state.sourceReads >= task.budgets.sourceReadsTotal) {
            await denyTool(input, state, { kind: "read", signature: "total-read-budget", file, range, reason: "total-read-budget" }, "READ DENIED. The total task source-read budget is exhausted. Work from current context.")
          }
          if (state.sourceTokens + tokens > task.budgets.sourceTokensTotal) {
            await denyTool(input, state, { kind: "read", signature: "total-token-budget", file, range, reason: "total-token-budget" }, "READ DENIED. The total task source-token budget is exhausted. Work from current context.")
          }
          state.sourceReads += 1
          state.sourceTokens += tokens
          state.perFileReads.set(file, prior + 1)
          state.readRanges.set(file, [...priorRanges, range])
        }
      }

      if (SEARCH_TOOLS.has(tool)) {
        signature = normalizeSearchSignature(tool, args)
        if (state.signatures.has(signature)) {
          await denyTool(input, state, { kind: "search", signature, reason: "repeated-search" }, "SEARCH DENIED. This search has already been performed. Do not retry it with only a different result limit; use the findings already in context or make the implementation edit.")
        }
        const searchText = JSON.stringify(args).toLowerCase()
        if (/\*\*\/\*|\*\*|--files|(^|[\\/])src[\\/]?["'}\s,]*$/i.test(searchText)) {
          await denyTool(input, state, { kind: "search", signature, reason: "broad-search" }, "SEARCH DENIED. Broad repository search is disabled. Do not retry with cosmetic argument changes; search one exact allowlisted file or use current context.")
        }
        if (!state.editCount && requiresFirstEdit(task, loopControl) && inspectionBudgetExhausted(state)) {
          await denyTool(input, state, { kind: "search", signature: "milestone:search", reason: "first-edit-milestone" }, "INSPECTION BUDGET EXHAUSTED. Make the first implementation edit now using the context already collected.")
        }
        if (state.searchCalls >= (task.budgets.searchCallsBeforeFirstEdit ?? 4)) {
          const message = !state.editCount && requiresFirstEdit(task, loopControl)
            ? "INSPECTION BUDGET EXHAUSTED. Make the first implementation edit now using the context already collected."
            : "SEARCH DENIED. The task search budget is exhausted. Use current findings and edit."
          await denyTool(input, state, { kind: "search", signature: "search-budget", reason: "search-budget" }, message)
        }
        state.searchCalls += 1
        state.sourceTokens += 800
      }

      if (EDIT_TOOLS.has(tool)) {
        const files = extractToolPaths(root, args)
        if (!files.length) {
          await denyTool(input, state, { kind: "edit", signature, reason: "missing-edit-target" }, "EDIT DENIED. The harness could not resolve the edit target; use an edit tool with an explicit file path.")
        }
        for (const file of files) {
          if (!matchesAny(file, task.allowedEdit)) {
            await denyTool(input, state, { kind: "edit", signature, file, reason: "outside-edit-allowlist" }, `EDIT DENIED. ${file} is outside the ${task.mode} edit allowlist.`)
          }
          const protection = (locks.protectedFiles ?? []).find((item) => slash(item.path).toLowerCase() === file.toLowerCase())
          if (protection && !(protection.allowedModes ?? []).includes(task.mode)) {
            await denyTool(input, state, { kind: "edit", signature, file, reason: "protected-file" }, `EDIT DENIED. ${file} is locked during ${task.mode} work.`)
          }
        }
      }

      if (tool === "bash" || tool === "shell") {
        const command = commandFromArgs(args)
        signature = `shell:${normalizeShellSignature(args)}`
        if (state.signatures.has(signature)) {
          await denyTool(input, state, { kind: "shell", signature, reason: "repeated-shell-command" }, "COMMAND DENIED. This shell command has already run. Do not retry it with cosmetic output-limit changes; use the result already in context or change strategy.")
        }
        if (/\b(?:puppeteer|playwright|qwen[-_ ]?vl|vision server|screenshot)\b/i.test(command)) {
          await denyTool(input, state, { kind: "shell", signature, reason: "visual-automation" }, "COMMAND DENIED. Visual automation is disabled. Record this item for human QA; do not retry this command.")
        }
        if (/(?:get-childitem|gci|dir)\b[^\r\n]*(?:-recurse|\/s\b)|\btree\b|\brg\b[^\r\n]*--files|\bgrep\b[^\r\n]*-(?:r|R)\b|\bgit\s+ls-files\b/i.test(command)) {
          await denyTool(input, state, { kind: "shell", signature, reason: "broad-shell-scan" }, "COMMAND DENIED. Recursive or whole-repository enumeration is disabled. Do not retry with cosmetic command changes.")
        }
        if (/(?:get-content|\btype\b|\bmore\b)\s+[^\r\n]*(?:src[\\/]|prompt|important)/i.test(command)) {
          await denyTool(input, state, { kind: "shell", signature, reason: "shell-source-read" }, "COMMAND DENIED. Read source with the bounded read tool; do not bypass source-read tracking through the shell.")
        }
        if (/(?:set-content|add-content|out-file|\bsed\s+-i\b|\bdel\b|remove-item|\brm\b)/i.test(command)) {
          await denyTool(input, state, { kind: "shell", signature, reason: "shell-mutation" }, "COMMAND DENIED. Use the tracked edit tool for source changes; destructive shell mutations are disabled.")
        }
      }

      if (!sourceRead && !SEARCH_TOOLS.has(tool) && tool !== "bash" && tool !== "shell" && state.signatures.has(signature)) {
        await denyTool(input, state, { kind: tool, signature, reason: "repeated-tool-call" }, `TOOL DENIED. This ${tool} call has already been attempted. Do not retry it unchanged; use the existing result or change strategy.`)
      }
      state.signatures.add(signature)
      markAllowed(state)
      saveRuntime(input.sessionID, state)
    },

    "tool.execute.after": async (input, output) => {
      const tool = input.tool.toLowerCase()
      const state = session(input.sessionID)
      if (READ_TOOLS.has(tool)) {
        const files = extractToolPaths(root, input.args ?? {})
        const promptFile = files.find((file) => taskPromptFile(file))
        if (promptFile && String(output.output ?? "").trim()) {
          const nextTask = buildTask(String(output.output), input.sessionID, policy)
          state.task = nextTask
          writeJson(path.join(stateDir, "task.json"), nextTask)
          writeSessionContext(root, nextTask, state, locks)
          output.output = `${String(output.output)}\n\n[DEADGRID: task prompt classified as ${nextTask.mode}. Read ${SESSION_CONTEXT_FILE} once, then use targeted source reads.]`
        }
      }
      if (EDIT_TOOLS.has(tool)) {
        const files = extractToolPaths(root, input.args ?? {})
        for (const file of files) state.changedFiles.add(file)
        state.editCount += 1
        state.pendingDirective = null
        state.consecutiveBlockedAttempts = 0
        state.loopEscalated = false
        const interval = state.task.budgets.editsBeforeTypecheck
        if (state.editCount - state.editsAtLastAutoCheck >= interval) {
          const checkpoint = { ...runCheck(root, "typecheck"), editCount: state.editCount }
          state.checkpoints.push(checkpoint)
          appendCheckpoint(root, checkpoint, input.sessionID, state.editCount)
          state.editsAtLastAutoCheck = state.editCount
          output.output += `\n\n[DEADGRID checkpoint: typecheck ${checkpoint.passed ? "passed" : "FAILED"}]`
        }
      }
      if ((READ_TOOLS.has(tool) || SEARCH_TOOLS.has(tool))
        && !state.editCount
        && requiresFirstEdit(state.task, loopControl)
        && inspectionBudgetExhausted(state)) {
        const milestone = "INSPECTION BUDGET EXHAUSTED. Make the first implementation edit now using the context already collected."
        state.pendingDirective = milestone
        output.output = `${String(output.output ?? "")}\n\n[DEADGRID milestone: ${milestone}]`
      }
      const diagnosticTokens = Math.floor(Number(loopControl.contextWindowTokens ?? 256000) * Number(loopControl.firstEditDiagnosticPercent ?? 15) / 100)
      if (!state.editCount && !state.contextDiagnosticEmitted && state.sourceTokens >= diagnosticTokens) {
        state.contextDiagnosticEmitted = true
        output.output = `${String(output.output ?? "")}\n\n[DEADGRID diagnostic: no implementation edit yet after approximately ${state.sourceTokens} source tokens. Make the first meaningful edit now; this diagnostic does not abort the response.]`
      }
      if (tool === "bash" || tool === "shell") {
        const command = commandFromArgs(input.args)
        const name = /npm(?:\.cmd)?\s+run\s+build/i.test(command) ? "build" : /npm(?:\.cmd)?\s+run\s+typecheck|\btsc\b/i.test(command) ? "typecheck" : null
        if (name) {
          const passed = !/error|failed|exit code [1-9]/i.test(output.output ?? "")
          const checkpoint = { name, command, editCount: state.editCount, startedAt: new Date().toISOString(), finishedAt: new Date().toISOString(), passed, exitCode: passed ? 0 : 1, summary: String(output.output ?? "").slice(-4000) }
          state.checkpoints.push(checkpoint)
          appendCheckpoint(root, checkpoint, input.sessionID, state.editCount)
          if (name === "typecheck" && passed) state.editsAtLastAutoCheck = state.editCount
          output.output += `\n\n[DEADGRID: ${name} is a component check. Final regression requires both typecheck and production build for edit state ${state.editCount}.]`
        }
      }
      saveRuntime(input.sessionID, state)
    },

    event: async ({ event }) => {
      const sessionID = event?.properties?.sessionID ?? event?.properties?.info?.id ?? event?.sessionID
      if (event?.type === "session.idle") {
        if (sessionID && sessions.has(sessionID)) finalize(sessionID, sessions.get(sessionID))
        else for (const [id, state] of sessions) finalize(id, state)
      }
      if (event?.type === "session.error") {
        if (sessionID && sessions.has(sessionID)) finalize(sessionID, sessions.get(sessionID), "interrupted")
      }
    },
  }
}
