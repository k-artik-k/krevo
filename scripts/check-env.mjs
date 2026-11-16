// Runs before `npm run dev` / `npm run preview`. Warns (never blocks) when local admin secrets look wrong.
import { existsSync, readFileSync, readdirSync } from "node:fs";

const file = ".dev.vars";
const warn = (m) => console.log(`\n[check-env] ${m}\n`);

if (!existsSync(file)) {
  const similar = readdirSync(".").filter((f) => /dev.*vars/i.test(f) && f !== ".dev.vars.example");
  warn(
    `No ${file} file in this folder, so admin sign-in will say "Admin sign-in is not set up".\n` +
      (similar.length ? `  Found a similarly named file: ${similar.join(", ")}. It must be named exactly ${file} (on Windows, check it didn't get a hidden .txt ending).\n` : "") +
      `  Fix: run  npm run hash-password  and put the two printed lines in a file named ${file} here, then restart.`,
  );
  process.exit(0);
}

const vars = Object.fromEntries(
  readFileSync(file, "utf8").split(/\r?\n/).map((l) => l.match(/^\s*([A-Z_]+)\s*=\s*"?([^"]*)"?\s*$/)).filter(Boolean).map((m) => [m[1], m[2]]),
);
const problems = [];
if (!vars.ADMIN_PASSWORD_HASH) problems.push("ADMIN_PASSWORD_HASH is missing");
else if (!/^pbkdf2-sha256:\d+:[\w-]+:[\w-]+$/.test(vars.ADMIN_PASSWORD_HASH)) problems.push("ADMIN_PASSWORD_HASH is not in the expected format (pbkdf2-sha256:100000:salt:hash)");
if (!vars.SESSION_SECRET) problems.push("SESSION_SECRET is missing");
else if (vars.SESSION_SECRET.length < 32) problems.push("SESSION_SECRET is too short (use the 64-character value from npm run hash-password)");
if (problems.length) warn(`${file} has problems:\n  - ${problems.join("\n  - ")}`);
else console.log("[check-env] .dev.vars looks good. If you edit it, restart the dev server (preview rebuilds automatically).");