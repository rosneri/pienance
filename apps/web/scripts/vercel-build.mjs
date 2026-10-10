// Vercel's build for the web app: report which database variables exist (names only,
// never values), apply pending migrations, then build Next.js.
import { execSync } from "node:child_process";

const names = Object.keys(process.env).filter((name) => /DATABASE|POSTGRES|PRISMA/.test(name));

console.log(`Database variables present: ${names.join(", ") || "none"}`);

execSync("pnpm --filter @pienance/db exec prisma migrate deploy", { stdio: "inherit" });

execSync("next build", { stdio: "inherit" });
