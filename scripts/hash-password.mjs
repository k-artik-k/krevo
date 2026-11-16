// Generates ADMIN_PASSWORD_HASH and SESSION_SECRET values for .dev.vars / wrangler secrets.
import { pbkdf2Sync, randomBytes } from "node:crypto";
import readline from "node:readline";

const ITER = 100000; // Cloudflare Workers caps PBKDF2 at 100,000 iterations.
const b64u = (b) => Buffer.from(b).toString("base64url");

function ask(q) {
  return new Promise((resolve) => {
    const rl = readline.createInterface({ input: process.stdin, output: process.stdout, terminal: true });
    rl._writeToOutput = (s) => { if (s.includes(q)) process.stdout.write(s); };
    rl.question(q, (a) => { rl.close(); process.stdout.write("\n"); resolve(a); });
  });
}

const pw = process.argv[2] ?? (await ask("Choose an admin password (min 12 chars): "));
if (pw.length < 12) { console.error("Password must be at least 12 characters."); process.exit(1); }
const salt = randomBytes(16);
const hash = pbkdf2Sync(pw, salt, ITER, 32, "sha256");
console.log("\nAdd these to .dev.vars (local) and set them as Cloudflare secrets (production):\n");
console.log(`ADMIN_PASSWORD_HASH="pbkdf2-sha256:${ITER}:${b64u(salt)}:${b64u(hash)}"`);
console.log(`SESSION_SECRET="${randomBytes(32).toString("hex")}"\n`);
