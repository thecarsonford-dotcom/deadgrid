import fs from "node:fs"
import path from "node:path"
import assert from "node:assert/strict"
import { DeadgridGuard } from "../../.opencode/plugins/deadgrid-guard.js"

const repoRoot = path.resolve(import.meta.dirname, "../..")
const testRoot = path.join(repoRoot, ".deadgrid", "runtime", "harness-test")
const workspace = path.join(testRoot, "workspace")

if (!workspace.startsWith(`${testRoot}${path.sep}`)) throw new Error("Unsafe harness-test workspace path")
fs.rmSync(workspace, { recursive: true, force: true })
fs.mkdirSync(path.join(workspace, ".deadgrid", "runtime"), { recursive: true })
fs.mkdirSync(path.join(workspace, ".opencode", "plugins"), { recursive: true })
fs.mkdirSync(path.join(workspace, "src"), { recursive: true })
fs.copyFileSync(
  path.join(repoRoot, ".opencode", "plugins", "deadgrid-guard.js"),
  path.join(workspace, ".opencode", "plugins", "deadgrid-guard.js"),
)

const policy = JSON.parse(fs.readFileSync(path.join(repoRoot, ".deadgrid", "policy.json"), "utf8"))
policy.defaults = {
  ...policy.defaults,
  sourceReadsBeforeFirstEdit: 4,
  sourceTokensBeforeFirstEdit: 200000,
  searchCallsBeforeFirstEdit: 2,
  sourceReadsTotal: 20,
  sourceTokensTotal: 250000,
  readsPerFileBeforeFirstEdit: 2,
  readsPerFileTotal: 10,
}

fs.writeFileSync(path.join(workspace, ".deadgrid", "project.json"), "{}\n")
fs.writeFileSync(path.join(workspace, ".deadgrid", "policy.json"), `${JSON.stringify(policy, null, 2)}\n`)
fs.writeFileSync(path.join(workspace, ".deadgrid", "locks.json"), "{\"decisions\":[],\"protectedFiles\":[]}\n")
fs.writeFileSync(path.join(workspace, ".deadgrid", "last-session.json"), "{\"status\":\"none\",\"changedFiles\":[]}\n")
fs.writeFileSync(path.join(workspace, ".deadgrid", "task.json"), "{\"status\":\"awaiting_goal\"}\n")
fs.writeFileSync(path.join(workspace, ".deadgrid", "architecture.json"), JSON.stringify({
  domains: { orchestration: ["src/game.ts"], player: ["src/player.ts", "src/input.ts"] },
  largeFiles: { "src/game.ts": "Read targeted ranges only." },
}))
fs.writeFileSync(path.join(workspace, ".deadgrid", "known-issues.json"), "{\"issues\":[]}\n")
fs.writeFileSync(path.join(workspace, ".deadgrid", "campaign.json"), "{\"criticalPath\":[],\"designContract\":[]}\n")
fs.writeFileSync(path.join(workspace, "1.md"), "Fix the broken startup behavior in src/game.ts.\n")

const sourceBody = Array.from({ length: 1800 }, (_, index) => `export const line${index} = ${index}`).join("\n")
for (const file of ["game.ts", "player.ts", "input.ts", "audio.ts"]) {
  fs.writeFileSync(path.join(workspace, "src", file), `${sourceBody}\n`)
}

const aborts = []
const client = {
  session: {
    abort: async (options) => {
      aborts.push(options)
      return { data: true }
    },
  },
}
const hooks = await DeadgridGuard({ client, directory: workspace })

async function start(sessionID, prompt) {
  await hooks["chat.message"]({ sessionID }, { parts: [{ type: "text", text: prompt }] })
}

async function before(sessionID, tool, callID, args) {
  const output = { args }
  await hooks["tool.execute.before"]({ tool, sessionID, callID }, output)
  return output
}

async function after(sessionID, tool, callID, args, text = "synthetic tool result") {
  const output = { title: "synthetic", output: text, metadata: {} }
  await hooks["tool.execute.after"]({ tool, sessionID, callID, args }, output)
  return output
}

async function allowed(sessionID, tool, callID, args, text) {
  await before(sessionID, tool, callID, args)
  return after(sessionID, tool, callID, args, text)
}

async function denied(sessionID, tool, callID, args, pattern) {
  let message = ""
  try {
    await before(sessionID, tool, callID, args)
  } catch (error) {
    message = String(error?.message ?? error)
  }
  assert.match(message, pattern)
  return message
}

const game = path.join(workspace, "src", "game.ts")
const player = path.join(workspace, "src", "player.ts")
const inputFile = path.join(workspace, "src", "input.ts")
const audio = path.join(workspace, "src", "audio.ts")
const context = path.join(workspace, ".deadgrid", "runtime", "session-context.md")

// Bootstrap: prompt and generated context are free; internal JSON is not agent-facing.
await start("real-pattern", "Read 1.md exactly once and execute the task")
await allowed("real-pattern", "read", "p1", { filePath: path.join(workspace, "1.md"), offset: 0, limit: 50 }, fs.readFileSync(path.join(workspace, "1.md"), "utf8"))
assert.ok(fs.existsSync(context))
assert.match(fs.readFileSync(context, "utf8"), /Mode: BUGFIX/)
await allowed("real-pattern", "read", "c1", { filePath: context, offset: 0, limit: 300 }, fs.readFileSync(context, "utf8"))
let bootstrapRuntime = JSON.parse(fs.readFileSync(path.join(workspace, ".deadgrid", "runtime", "real-pattern.json"), "utf8"))
assert.equal(bootstrapRuntime.sourceReads, 0)
await denied("real-pattern", "read", "meta1", { filePath: path.join(workspace, ".deadgrid", "policy.json") }, /HARNESS METADATA READ DENIED/)

// Real-world pattern: overview plus materially different targeted ranges all succeed.
await allowed("real-pattern", "read", "r1", { filePath: game, offset: 0, limit: 600 })
await allowed("real-pattern", "read", "r2", { filePath: game, offset: 150, limit: 100 })
await allowed("real-pattern", "read", "r3", { filePath: game, offset: 820, limit: 100 })
await allowed("real-pattern", "read", "r4", { filePath: game, offset: 940, limit: 100 })
await denied("real-pattern", "read", "r5", { filePath: game, offset: 820, limit: 100 }, /READ DENIED/)
await denied("real-pattern", "read", "r6", { filePath: game, offset: 820, limit: 90 }, /LOOP DETECTED/)
await denied("real-pattern", "read", "r7", { filePath: game, offset: 820, limit: 85 }, /LOOP DETECTED/)
assert.equal(aborts.length, 1)

// A genuinely different successful action resets consecutive blocked escalation.
await start("reset-loop", "Fix the broken startup in src/game.ts")
await allowed("reset-loop", "read", "x1", { filePath: game, offset: 1200, limit: 100 })
await denied("reset-loop", "read", "x2", { filePath: game, offset: 1200, limit: 95 }, /READ DENIED/)
await allowed("reset-loop", "bash", "x3", { command: "Write-Output genuinely-different-action" })
await denied("reset-loop", "read", "x4", { filePath: game, offset: 1200, limit: 90 }, /READ DENIED/)
assert.equal(aborts.length, 1)

// A root task prompt is free once, then denied regardless of range changes.
await start("prompt-loop", "Fix the broken startup described in 1.md")
await allowed("prompt-loop", "read", "p1", { filePath: path.join(workspace, "1.md"), offset: 0, limit: 50 }, fs.readFileSync(path.join(workspace, "1.md"), "utf8"))
let promptRuntime = JSON.parse(fs.readFileSync(path.join(workspace, ".deadgrid", "runtime", "prompt-loop.json"), "utf8"))
assert.equal(promptRuntime.sourceReads, 0)
await denied("prompt-loop", "read", "p2", { filePath: path.join(workspace, "1.md"), offset: 5, limit: 20 }, /TASK PROMPT READ DENIED/)
await denied("prompt-loop", "read", "p3", { filePath: path.join(workspace, "1.md"), offset: 30, limit: 5 }, /LOOP DETECTED/)

// Search signatures ignore cosmetic result-limit changes.
await start("search-loop", "Fix the broken startup in src/game.ts")
await allowed("search-loop", "grep", "g1", { pattern: "spawnFirstEncounter", path: game, limit: 100 })
await denied("search-loop", "grep", "g2", { pattern: "spawnFirstEncounter", path: game, limit: 50 }, /SEARCH DENIED/)
await denied("search-loop", "grep", "g3", { pattern: "spawnFirstEncounter", path: game, limit: 25 }, /LOOP DETECTED/)

// Shell signatures ignore cosmetic output-limit changes.
await start("shell-loop", "Fix the broken startup in src/game.ts")
await allowed("shell-loop", "bash", "s1", { command: "Write-Output harness-probe | Select-Object -First 20" })
await denied("shell-loop", "bash", "s2", { command: "write-output harness-probe | select-object -first 10" }, /COMMAND DENIED/)
await denied("shell-loop", "bash", "s3", { command: "write-output harness-probe | select-object -first 5" }, /LOOP DETECTED/)

// Reaching the BUGFIX pre-edit threshold emits a milestone, then blocks more inspection.
await start("milestone", "Fix the broken campaign startup in src/game.ts")
await allowed("milestone", "read", "m1", { filePath: game, offset: 0, limit: 10 })
await allowed("milestone", "read", "m2", { filePath: player, offset: 0, limit: 10 })
await allowed("milestone", "read", "m3", { filePath: inputFile, offset: 0, limit: 10 })
const thresholdOutput = await allowed("milestone", "read", "m4", { filePath: audio, offset: 0, limit: 10 })
assert.match(thresholdOutput.output, /INSPECTION BUDGET EXHAUSTED/)
await denied("milestone", "read", "m5", { filePath: player, offset: 30, limit: 10 }, /INSPECTION BUDGET EXHAUSTED/)
await denied("milestone", "read", "m6", { filePath: audio, offset: 30, limit: 10 }, /LOOP DETECTED/)

// A first edit clears the milestone and permits a genuinely new targeted read.
await allowed("milestone", "edit", "m7", { filePath: game })
await allowed("milestone", "read", "m8", { filePath: inputFile, offset: 30, limit: 10 })

const result = {
  passed: true,
  testedAt: new Date().toISOString(),
  assertions: {
    overviewThenTargetedRanges: "all four legitimate reads allowed",
    redundantRangeRetries: "first blocked; second consecutive equivalent blocked attempt escalated",
    successfulDifferentAction: "reset consecutive blocked escalation",
    generatedSessionContext: "created, read once, and excluded from source budget",
    internalMetadataReads: "blocked and excluded from source budget",
    repeatedPromptRead: "blocked and excluded from source budget",
    repeatedGrep: "blocked with loop escalation",
    repeatedShellCommand: "blocked with loop escalation",
    firstEditMilestone: "emitted and enforced",
    editThenNewRead: "allowed",
    sessionAbortCalls: aborts.length,
  },
}
fs.mkdirSync(testRoot, { recursive: true })
fs.writeFileSync(path.join(testRoot, "results.json"), `${JSON.stringify(result, null, 2)}\n`)
console.log("DEADGRID loop-control synthetic test: PASS")
