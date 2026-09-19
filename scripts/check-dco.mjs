import { execFileSync } from "node:child_process";

const [base, head = "HEAD"] = process.argv.slice(2);

if (!base) {
  console.error("Usage: node scripts/check-dco.mjs <base-ref> [head-ref]");
  process.exit(2);
}

const git = (...args) =>
  execFileSync("git", args, { encoding: "utf8" }).trim();

const commits = git("rev-list", "--no-merges", `${base}..${head}`)
  .split("\n")
  .filter(Boolean);

const failures = [];

for (const commit of commits) {
  const authorName = git("show", "-s", "--format=%an", commit);
  const authorEmail = git("show", "-s", "--format=%ae", commit);
  const message = git("show", "-s", "--format=%B", commit);
  const botCommit = authorName.endsWith("[bot]") || authorEmail.includes("[bot]");

  if (botCommit) continue;

  const signoffs = [...message.matchAll(/^Signed-off-by:\s*(.+?)\s*<([^>]+)>\s*$/gim)];
  const authorSigned = signoffs.some(
    ([, , email]) => email.toLowerCase() === authorEmail.toLowerCase(),
  );

  if (!authorSigned) {
    failures.push(`${commit.slice(0, 12)} by ${authorName} <${authorEmail}>`);
  }
}

if (failures.length > 0) {
  console.error("The following commits need an author Signed-off-by line:");
  for (const failure of failures) console.error(`- ${failure}`);
  console.error("\nFix with `git commit --amend --signoff` for the latest commit, then push again.");
  process.exit(1);
}

console.log(`DCO sign-off verified for ${commits.length} commit(s).`);
