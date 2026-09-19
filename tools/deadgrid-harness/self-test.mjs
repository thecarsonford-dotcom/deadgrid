import fs from "node:fs"
import path from "node:path"
import os from "node:os"
import assert from "node:assert/strict"
import { DeadgridGuard } from "../../.opencode/plugins/deadgrid-guard.js"

const root = path.resolve(import.meta.dirname, "../..")
const policy = JSON.parse(fs.readFileSync(path.join(root, ".deadgrid/policy.json"), "utf8"))

const sandbox = fs.mkdtempSync(path.join(os.tmpdir(), "deadgrid-harness-test-"))
try {
  fs.mkdirSync(path.join(sandbox, ".deadgrid/runtime"), { recursive: true })
  fs.writeFileSync(path.join(sandbox, ".deadgrid/project.json"), "{}")
  fs.writeFileSync(path.join(sandbox, ".deadgrid/policy.json"), JSON.stringify(policy))
  fs.writeFileSync(path.join(sandbox, ".deadgrid/locks.json"), JSON.stringify({ decisions: [], protectedFiles: [] }))
  fs.writeFileSync(path.join(sandbox, ".deadgrid/last-session.json"), JSON.stringify({ status: "none", changedFiles: [] }))
  fs.writeFileSync(path.join(sandbox, ".deadgrid/task.json"), JSON.stringify({ status: "awaiting_goal" }))
  fs.mkdirSync(path.join(sandbox, "src/world"), { recursive: true })
  fs.writeFileSync(path.join(sandbox, "src/world/roads.ts"), "export const road = true\n")
  fs.writeFileSync(path.join(sandbox, "src/game.ts"), "export const game = true\n")

  const hooks = await DeadgridGuard({ directory: sandbox })
  await hooks["chat.message"]({ sessionID: "test-session" }, { parts: [{ type: "text", text: "Improve the cabin road and relay route" }] })
  let task = JSON.parse(fs.readFileSync(path.join(sandbox, ".deadgrid/task.json"), "utf8"))
  assert.equal(task.mode, "LEVEL_DESIGN")
  await hooks["tool.execute.before"](
    { tool: "read", sessionID: "test-session", callID: "1" },
    { args: { filePath: path.join(sandbox, "src/world/roads.ts"), offset: 0, limit: 20 } },
  )
  await assert.rejects(
    hooks["tool.execute.before"](
      { tool: "read", sessionID: "test-session", callID: "2" },
      { args: { filePath: path.join(sandbox, "src/world/roads.ts"), offset: 0, limit: 20 } },
    ),
    /READ DENIED/,
  )
  await assert.rejects(
    hooks["tool.execute.before"](
      { tool: "bash", sessionID: "test-session", callID: "3" },
      { args: { command: "Get-ChildItem -Recurse src" } },
    ),
    /Recursive or whole-repository enumeration/,
  )
  await assert.rejects(
    hooks["tool.execute.before"](
      { tool: "edit", sessionID: "test-session", callID: "4" },
      { args: { filePath: path.join(sandbox, "src/player.ts") } },
    ),
    /outside the LEVEL_DESIGN edit allowlist/,
  )

  await hooks["chat.message"]({ sessionID: "viewmodel-session" }, { parts: [{ type: "text", text: "Fix the pistol viewmodel recoil" }] })
  task = JSON.parse(fs.readFileSync(path.join(sandbox, ".deadgrid/task.json"), "utf8"))
  assert.equal(task.mode, "VIEWMODEL")

  await hooks["chat.message"]({ sessionID: "release-session" }, { parts: [{ type: "text", text: "Run release typecheck and build QA" }] })
  task = JSON.parse(fs.readFileSync(path.join(sandbox, ".deadgrid/task.json"), "utf8"))
  assert.equal(task.mode, "RELEASE_QA")

  await hooks["chat.message"]({ sessionID: "bugfix-session" }, { parts: [{ type: "text", text: "Fix the broken startup in src/game.ts" }] })
  await hooks["tool.execute.before"](
    { tool: "read", sessionID: "bugfix-session", callID: "5" },
    { args: { filePath: path.join(sandbox, "src/game.ts"), offset: 0, limit: 20 } },
  )
} finally {
  fs.rmSync(sandbox, { recursive: true, force: true })
}

console.log("DEADGRID harness self-test: PASS")
