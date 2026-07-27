import { existsSync } from "node:fs";
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
  const cwd = resolve(dir);
  const useCi = existsSync(resolve(cwd, "package-lock.json"));
  const args = useCi ? ["ci"] : ["install"];
  const result = spawnSync("npm", args, {
    cwd,
    stdio: "inherit",
    shell: process.platform === "win32",
    env: {
      ...process.env,
      npm_config_fund: "false",
      npm_config_audit: "false",
    },
  });

  if (result.status !== 0) {
    hadFailure = true;
    break;
  }
}

process.exit(hadFailure ? 1 : 0);
