---
name: lint-gherkin
description: Run Gherkin linting on all feature files in the frontend directory. Use when validating Gherkin syntax, checking feature file quality, or verifying formatting compliance.
disable-model-invocation: false
allowed-tools: Bash(yarn *)
---

Run Gherkin linting in the frontend directory:

```bash
cd /home/scsh/work/github.com/scriptingshrimp/kiali/frontend && yarn lint:gherkin
```

The linting tool will validate all .feature files under `cypress/integration/featureFiles/` and report any syntax or formatting issues.

**What it checks:**
- Valid Gherkin syntax
- Proper indentation (2-space for scenarios, 4-space for steps)
- No trailing spaces or excessive empty lines
- Named features and scenarios (no unnamed items)
- No duplicate names
- Newline at end of file
- No empty files or backgrounds

If errors are found, they will be displayed with line numbers and specific rule violations.
