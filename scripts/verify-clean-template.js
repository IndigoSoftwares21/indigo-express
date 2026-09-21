#!/usr/bin/env node

// Guards against publishing local dev artifacts from inside template/ — npm's
// packing rules for a nested directory that's explicitly whitelisted via the
// "files" field are not reliable enough to trust blindly (template/node_modules
// has shipped in a packed tarball before). Run before every publish.

const { existsSync } = require("fs");
const path = require("path");

const FORBIDDEN = [
  "template/node_modules",
  "template/dist",
  "template/.env",
];

const offenders = FORBIDDEN.filter((relPath) =>
  existsSync(path.join(__dirname, "..", relPath))
);

if (offenders.length > 0) {
  console.error(
    "Refusing to publish: found local dev artifacts that must not ship:\n" +
      offenders.map((p) => `  - ${p}`).join("\n") +
      "\n\nRemove them and try again."
  );
  process.exit(1);
}

console.log("template/ is clean — safe to publish.");
