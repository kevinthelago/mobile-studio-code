"""Drive an interactive eas-cli command through a Windows ConPTY (pywinpty).

Headless harnesses have no TTY, and eas-cli's prompts refuse piped stdin
("Input is required, but stdin is not readable"). pywinpty allocates a real
pseudo-console so the prompt is satisfied, and we answer it programmatically.

Answers:
  - "Generate a new Apple Provisioning Profile?" -> y   (regenerate, picks up push)
  - "Would you like to reuse the original profile?" -> n (never reuse the stale one)
"""
import os
import sys
import winpty

sys.stdout.reconfigure(encoding="utf-8", errors="replace")

env = os.environ.copy()
argv = [
    "node", "node_modules/eas-cli/bin/run",
    "credentials:configure-build", "-p", "ios", "-e", "production",
]

proc = winpty.PtyProcess.spawn(argv, env=env, dimensions=(50, 200))

buf = ""
answered = set()
while proc.isalive():
    try:
        data = proc.read(2048)
    except EOFError:
        break
    if not data:
        continue
    sys.stdout.write(data)
    sys.stdout.flush()
    buf += data
    if "Generate a new Apple Provisioning Profile" in buf and "gen" not in answered:
        proc.write("y\r")
        answered.add("gen")
        buf = ""
    elif "reuse the original profile" in buf and "reuse" not in answered:
        proc.write("n\r")
        answered.add("reuse")
        buf = ""

# Drain anything left after exit.
try:
    while True:
        rest = proc.read(2048)
        if not rest:
            break
        sys.stdout.write(rest)
except EOFError:
    pass
sys.stdout.flush()
print("\n[pty] exit status:", proc.exitstatus)
