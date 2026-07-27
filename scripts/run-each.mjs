import { spawnSync } from "node:child_process";
import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";

const DEFAULT_TARGETS = [
  "packages/errors",
  "packages/permissions",
  "packages/workflow-schema",
  "apps/api",
  "apps/web",
];

const [scriptName, ...rest] = process.argv.slice(2);
const targets = rest.length > 0 ? rest : DEFAULT_TARGETS;

if (!scriptName) {
  process.exit(1);
}

let hadFailure = false;

for (const dir of targets) {
  const pkgPath = resolve(dir, "package.json");
  if (!existsSync(pkgPath)) {
    continue;
  }

  const pkg = JSON.parse(readFileSync(pkgPath, "utf8"));
  if (!pkg.scripts || !pkg.scripts[scriptName]) {
    continue;
  }

  const result = spawnSync("npm", ["run", scriptName], {
    cwd: resolve(dir),
    stdio: "inherit",
    shell: process.platform === "win32",
  });

  if (result.status !== 0) {
    hadFailure = true;
  }
}

process.exit(hadFailure ? 1 : 0);
