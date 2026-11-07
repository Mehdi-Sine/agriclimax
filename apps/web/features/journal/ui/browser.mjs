// Compatibility entrypoint: T32B supersedes the original regional-map browser checks.
for (const suffix of ["ORIGIN", "OUTPUT", "COMMIT"]) {
  if (!process.env[`TASK32B_${suffix}`] && process.env[`TASK32_${suffix}`])
    process.env[`TASK32B_${suffix}`] = process.env[`TASK32_${suffix}`];
}
await import("./browser-task32b.mjs");
