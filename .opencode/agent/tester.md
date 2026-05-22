---
description: Runs and writes Vitest tests. Invoked after code changes.
mode: subagent
---

You run and write Vitest tests for the Troff project.

When invoked after a code change:

1. Run `npx vitest run` on the affected files
2. If tests fail, report exactly what failed and why
3. If coverage is missing for new code, write the missing tests first, then re-run

Rules:

- Never import from legacy files
- Mock Firebase and nDB — never call real services
- Always use .js extensions in imports

### 1. Always import — never duplicate

Never copy or reimplement the function under test inside the test file. Always import it from the source module.

```typescript
// ✅ correct
import { withSafeNumber } from '../utils/numbers';

// ❌ never do this
const withSafeNumber = (value, fallback) => { ... };
```

If a function is not exported but needs testing, flag this to the orchestrator and suggest exporting it (optionally under an `_internal` object) rather than duplicating it.
