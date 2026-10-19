import { spawn } from "node:child_process";
import { existsSync } from "node:fs";
import { fileURLToPath } from "node:url";
import path from "node:path";

const root = fileURLToPath(new URL(".", import.meta.url));
const local = path.join(
  root,
  ".venv",
  process.platform === "win32" ? "Scripts/python.exe" : "bin/python",
);
const python =
  process.env.PYTHON_EXECUTABLE || (existsSync(local) ? local : "python");
const args =
  process.argv[2] === "test"
    ? ["-m", "unittest", "discover", "-s", "tests", "-v"]
    : ["index.py"];
const child = spawn(python, args, {
  cwd: root,
  env: process.env,
  stdio: "inherit",
  windowsHide: true,
});
child.on("error", () => {
  console.error(
    "Python could not start. Set PYTHON_EXECUTABLE or create api/.venv with Python 3.12 and install api/requirements.txt.",
  );
  process.exitCode = 1;
});
child.on("exit", (code) => {
  process.exitCode = code ?? 1;
});
