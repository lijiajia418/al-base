const { execSync } = require("child_process");

const port = process.argv[2] || 3000;

try {
  const pid = execSync(`lsof -ti:${port}`, { encoding: "utf-8" }).trim();
  if (pid) {
    execSync(`kill -9 ${pid}`);
    console.log(`Killed process ${pid} on port ${port}`);
  }
} catch {
  // No process on this port — nothing to do
}
