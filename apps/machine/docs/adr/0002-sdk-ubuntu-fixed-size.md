# Native SDK over system runtime, pinned to Ubuntu 1c/1G

Sandboxes are driven in-process via the `microsandbox` SDK against the system-installed runtime, with every Task sandbox created from a pinned Ubuntu image at 1 CPU / 1 GB (2x headroom for live resize). We chose this over shelling out to the CLI or per-task sizing so quota math, secret refs, metrics, and log streaming share one API; Phase 0 must prove the SDK under Bun and the compiled binary first because the SDK targets Node 22 with native platform packages.
