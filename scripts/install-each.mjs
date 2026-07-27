import { spawnSync } from "node:child_process";
import { resolve } from "node:path";

const TARGETS = [
  ".",
  "packages/errors",
  "packages/permissions",
  "packages/workflow-schema",
  "packages/flowpkg",
  "apps/api",
  "apps/web",
];
let hadFailure = false;

for (const dir of TARGETS) {
  const result = spawnSync("npm", ["install"], {
    cwd: resolve(dir),
    stdio: "inherit",
    shell: process.platform === "win32",
  });

  if (result.status !== 0) {
    hadFailure = true;
  }
}

process.exit(hadFailure ? 1 : 0);
