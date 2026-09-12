# SDK CLI fallback for the compiled binary

`bun test` / `bun run` drive sandboxes in-process via the `microsandbox` SDK.
The `bun build --compile` single-file binary cannot bundle the SDK's native
platform package (`native/index.cjs` missing at runtime), so the compiled
binary shells out to the system `msb` CLI instead (same pinned Ubuntu image,
same fixed 1c/1G + 2x max, same `task.id`/`project.id` labels, same
`stop --force` / `remove --force` verbs). Driver order is SDK -> CLI -> mock
(`MSB_MOCK=1` forces mock). We chose this over bundling natives or dropping
the single-binary distribution so quota math, secret refs, metrics, and log
streaming keep one interface (`src/sandboxes/sandbox.ts`) across all three drivers;
true streaming is SDK-only while CLI exec captures stdout/stderr separately.
