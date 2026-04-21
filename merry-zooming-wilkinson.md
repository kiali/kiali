# Implementation Plan: Gherkin .feature File Validation

## Context

Addresses [GitHub issue #9258](https://github.com/kiali/kiali/issues/9258) - validation of *.feature files.

**Problem:** PR #9151 accidentally overwrote `frontend/cypress/integration/featureFiles/overview.feature` with TypeScript code instead of Gherkin. Error only caught at runtime, required three commits (583e6c51f, c85e6035b, 627235b9b) to fix.

**Why:** Kiali has 53 .feature files with ~5,356 lines Gherkin specs. Critical BDD test definitions. Zero validation for Gherkin syntax. No protection against accidental overwrites. Errors caught only at runtime.

**Desired Outcome:** Automated validation:
1. Validates Gherkin syntax
2. Enforces consistent formatting/style (AI-generated scenarios need strict enforcement)
3. Prevents wrong code in .feature files
4. Runs in pre-commit hooks (issue author preference)
5. Optional: Pre-Cypress validation

**AI Context:** User generates Gherkin scenarios with AI agents. Requires strict style enforcement: consistent formatting, proper indentation, naming conventions, best practices.

## Solution Approach

**Defense-in-depth:** Two layers:
1. Pre-commit validation - catches before commit
2. Pre-Cypress validation - catches bypasses, runs before every Cypress suite (local + CI)

**Key Decision:** Use `gherkin-lint` - industry-standard Gherkin linter.
- Comprehensive style rules (indentation, spacing, naming)
- Configurable validation
- Better error messages than basic syntax validation
- Essential for validating AI-generated scenarios

## Implementation Steps

### Step 1: Add gherkin-lint Dependency

**File:** `frontend/package.json`

Add to `devDependencies`:
```json
"gherkin-lint": "^4.2.4"
```

Run `yarn install`.

### Step 2: Create gherkin-lint Configuration

**File:** `frontend/.gherkin-lintrc` (new)

Strict config for AI-generated scenarios:
```json
{
  "no-files-without-scenarios": "on",
  "no-unnamed-features": "on",
  "no-unnamed-scenarios": "on",
  "no-dupe-scenario-names": ["on", "in-feature"],
  "no-dupe-feature-names": "on",
  "no-partially-commented-tag-lines": "on",
  "indentation": ["on", {
    "Feature": 0,
    "Background": 2,
    "Scenario": 2,
    "Step": 4,
    "Examples": 4,
    "example": 6,
    "given": 4,
    "when": 4,
    "then": 4,
    "and": 4,
    "but": 4
  }],
  "no-trailing-spaces": "on",
  "no-multiple-empty-lines": ["on", { "max": 2 }],
  "new-line-at-eof": ["on", "yes"],
  "no-empty-file": "on",
  "allowed-tags": "off",
  "no-restricted-tags": "off",
  "no-scenario-outlines-without-examples": "on",
  "use-and": "off",
  "no-homogenous-tags": "off",
  "no-superfluous-tags": "off",
  "no-empty-background": "on"
}
```

Enforces:
- 2-space indentation for scenarios, 4-space for steps
- No trailing spaces or excessive empty lines
- Proper naming (no unnamed features/scenarios)
- No duplicate names
- Newline at EOF
- No empty files/backgrounds

### Step 3: Add npm Scripts

**File:** `frontend/package.json`

Add to `scripts`:
```json
"validate:gherkin": "gherkin-lint cypress/integration/featureFiles/*.feature",
"validate:gherkin:staged": "git diff --cached --name-only --diff-filter=AM | grep -E '\\.feature$' | xargs -r gherkin-lint"
```

- `validate:gherkin` - all .feature files (manual + CI)
- `validate:gherkin:staged` - staged files only (pre-commit)

### Step 4: Update Pre-commit Hook

**File:** `frontend/package.json` (line 88, modify existing `pre-commit`)

**Current:**
```json
"pre-commit": "yarn run pretty-quick --staged --no-restage --bail --pattern \"**/*.{ts,tsx,scss,json}\" && npm run lint:precommit && npm run format:precommit"
```

**Updated:**
```json
"pre-commit": "yarn run pretty-quick --staged --no-restage --bail --pattern \"**/*.{ts,tsx,scss,json}\" && npm run lint:precommit && npm run validate:gherkin:staged && npm run format:precommit"
```

Add Gherkin validation between TS linting + format check.

### Step 5: Add Pre-Cypress Validation to Integration Test Runner

**File:** `hack/run-integration-tests.sh`

Rename `ensureCypressInstalled()` to `ensureCypressReady()`, add Gherkin validation. Function called by all 14 frontend test suites - single change covers every Cypress path (local + CI).

**Current:**
```bash
ensureCypressInstalled() {
  cd "${SCRIPT_DIR}"/../frontend
  if ! yarn cypress --help &> /dev/null; then
    echo "cypress binary was not detected in your PATH. Did you install the frontend directory? Before running the frontend tests you must run 'make build-ui'."
    exit 1
  fi
  cd -
}
```

**Updated:**
```bash
ensureCypressReady() {
  cd "${SCRIPT_DIR}"/../frontend
  if ! yarn cypress --help &> /dev/null; then
    echo "cypress binary was not detected in your PATH. Did you install the frontend directory? Before running the frontend tests you must run 'make build-ui'."
    exit 1
  fi
  infomsg "Validating Gherkin feature files..."
  yarn validate:gherkin
  cd -
}
```

Rename all 14 call sites from `ensureCypressInstalled` to `ensureCypressReady`.

**Why better than separate CI workflow:**
- Runs everywhere Cypress runs (local + every CI suite)
- Natural gate: broken .feature files block Cypress, don't waste time
- Single insertion point, no separate workflow file
- Still catches `--no-verify` bypasses (CI test suites go through function)

### Step 6: Optional - Exclude .feature from Prettier

**File:** `frontend/.prettierignore` (modify if needed)

Add:
```
*.feature
```

Defensive measure - Prettier pattern `**/*.{ts,tsx,scss,json}` already excludes .feature. Since gherkin-lint handles .feature formatting, ensure Prettier doesn't interfere.

## Critical Files

Modified/created:
1. **NEW**: `frontend/.gherkin-lintrc` - configuration
2. **MODIFY**: `frontend/package.json` - dependency, scripts, pre-commit
3. **MODIFY**: `hack/run-integration-tests.sh` - rename function, add validation
4. **OPTIONAL**: `frontend/.prettierignore` - exclude .feature

## Verification Plan

### Manual Testing

1. **All existing .feature files pass:**
   ```bash
   cd frontend && yarn validate:gherkin
   ```

2. **Detects invalid Gherkin syntax:**
   ```bash
   echo "Feature Test Feature" > frontend/cypress/integration/featureFiles/test-syntax-error.feature
   cd frontend && yarn validate:gherkin
   rm frontend/cypress/integration/featureFiles/test-syntax-error.feature
   ```

3. **Detects style violations:**
   ```bash
   cat > frontend/cypress/integration/featureFiles/test-style-error.feature << 'EOF'
Feature: Test Feature
Scenario: Bad indentation
Given I have bad indentation
EOF
   cd frontend && yarn validate:gherkin
   rm frontend/cypress/integration/featureFiles/test-style-error.feature
   ```

4. **Pre-commit hook blocks invalid files:**
   ```bash
   echo "Feature Test" > frontend/cypress/integration/featureFiles/test-invalid.feature
   git add frontend/cypress/integration/featureFiles/test-invalid.feature
   git commit -m "test: should fail"
   git reset HEAD frontend/cypress/integration/featureFiles/test-invalid.feature
   rm frontend/cypress/integration/featureFiles/test-invalid.feature
   ```

### Pre-Cypress Validation Testing

1. **Validation runs before Cypress:**
   ```bash
   echo "Feature Test" > frontend/cypress/integration/featureFiles/test-invalid.feature
   hack/run-integration-tests.sh --test-suite local --tests-only true
   rm frontend/cypress/integration/featureFiles/test-invalid.feature
   ```

2. **Rename didn't break anything:**
   ```bash
   grep -r "ensureCypressInstalled" hack/run-integration-tests.sh
   ```

### End-to-End Testing

1. Valid Gherkin .feature → commit succeeds
2. TypeScript code in .feature → pre-commit blocks
3. Pre-commit bypassed (`--no-verify`) → pre-Cypress catches before tests
4. Existing Cypress tests run successfully

## Success Criteria

- ✅ gherkin-lint validates all 53 existing .feature files
- ✅ Detects invalid Gherkin syntax
- ✅ Enforces consistent style (indentation, spacing, naming)
- ✅ Pre-commit prevents committing invalid files
- ✅ Pre-Cypress validation runs before every suite (local + CI), blocks on invalid
- ✅ Performance <500ms for 53 files
- ✅ `yarn validate:gherkin` works for manual checks
- ✅ AI-generated scenarios validated for formatting/style
- ✅ PR #9151 bug prevented (gherkin-lint fails on TypeScript in .feature)

## Rollout Considerations

- **Single devDependency**: `gherkin-lint` (industry-standard, ~100KB)
- **Backward compatible**: verify all existing .feature files pass (may need minor formatting fixes)
- **Fast**: validation milliseconds, minimal workflow impact
- **Clear errors**: line numbers + rule names
- **Two-layer**: pre-commit early catch, pre-Cypress safety net
- **Manual option**: `yarn validate:gherkin`
- **AI-ready**: strict style ensures consistent AI-generated quality

## Alternative Approaches Considered

**Alternative 1: Custom script using @cucumber/gherkin**
- Pros: no new dependencies
- Cons: only syntax validation, no style enforcement, insufficient for AI scenarios
- Rejected

**Alternative 2: Validate in Cypress preprocessor only**
- Pros: at-test-runtime validation
- Cons: too late, doesn't prevent commits
- Rejected

**Alternative 3: Separate CI workflow (build-frontend.yml)**
- Pros: independent from tests
- Cons: separate file to maintain, doesn't gate Cypress, runs unnecessarily
- Rejected - pre-Cypress in `hack/run-integration-tests.sh` is more targeted

**Alternative 4: GitHub Actions only (no pre-commit)**
- Pros: simpler
- Cons: much later in workflow, wastes time
- Rejected

**Alternative 5: cucumber-lint instead of gherkin-lint**
- Pros: similar functionality
- Cons: gherkin-lint more actively maintained
- Rejected
