import fs from "node:fs";
import path from "node:path";

function walk(dir) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      if (entry.name === "node_modules" || entry.name === "dist") {
        continue;
      }
      walk(full);
      continue;
    }
    if (!full.endsWith(".ts")) {
      continue;
    }
    const source = fs.readFileSync(full, "utf8");
    const next = source.replace(/from ["'](\.[^"']+)\.js["']/g, 'from "$1"');
    if (next !== source) {
      fs.writeFileSync(full, next);
      console.log(full);
    }
  }
}

walk("packages");
