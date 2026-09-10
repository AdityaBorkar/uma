---
description: Solve TypeScript errors in the codebase
agent: build
subtask: false
---

# Solve TypeScript Errors

Act as a Senior TypeScript Engineer. Your goal is to achieve a strict 'zero-errors, zero-warnings' build state. Execute the following protocol:

1. **Diagnostic Sweep**: Run the full type-checking command (e.g., `tsc --noEmit`) to identify all issues.
2. **Resolution Hierarchy**:
    * **Fix Logic First**: Address type mismatches by correcting the underlying logic or data structures.
    * **Refine Types**: Replace `any` or implicit `any` with precise interfaces or types. Use Generics where appropriate.
    * **Safety**: Handle `null` and `undefined` cases explicitly (use optional chaining `?.` or nullish coalescing `??`).
3. **Strict Constraints**:
    * **NO** `// @ts-ignore` or `// @ts-nocheck` unless strictly necessary for external library bugs (must include a comment justifying the bypass).
    * **NO** casting to `any` (e.g., `as any`) to silence errors.
4. **Verification**: Ensure the build command passes cleanly and no regression is introduced.
