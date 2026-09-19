---
description: Run the DEADGRID typecheck and production-build checkpoint
---
Run `powershell -NoProfile -ExecutionPolicy Bypass -File tools/deadgrid-harness/checkpoint.ps1 -Kind final` once. Report the final-regression result and only the actionable errors. Final regression passes only when both typecheck and production build pass. A build-only pass is never a clean regression result. Do not start visual automation.
