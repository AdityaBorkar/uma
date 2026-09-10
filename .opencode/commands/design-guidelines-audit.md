---
description: Audit the codebase for design guidelines violations
agent: build
subtask: false
---

# Design Guidelines Audit

Act as a Senior Frontend Refactoring Agent.

Your goal is to standardize the repository's UI and iconography. Follow these strict directives:

1. **Context Analysis**: Parse `styles.css` to index all available design tokens (colors, spacing, typography). Identify all currently installed `shadcn/ui` components.
2. **Component Enforce**: Refactor UI elements to use `shadcn/ui` components exclusively. Replace raw HTML or custom styled elements with their `shadcn` equivalents where applicable.
3. **Token Usage**: Apply styling strictly using the variables defined in `styles.css`. Do not use hardcoded hex values or arbitrary spacing units.
4. **Iconography Lockdown**:
    * **EXCLUSIVE RULE**: The ONLY allowed icon library is `tabler icons`.
    * **Audit**: Scan every file for imports from other libraries (e.g., Lucide, FontAwesome, Radix Icons).
    * **Action**: Remove unauthorized imports and replace them with the closest matching `tabler icons` component.

Refactor the codebase to comply with the above directives.
