# Implementation Plan: Gherkin .feature File Validation

## Context

This implementation addresses [GitHub issue #9258](https://github.com/kiali/kiali/issues/9258) - validation of *.feature files.

**The Problem:**
In PR #9151, during a complex merge of the "New Overview and Namespaces pages" feature, the file `frontend/cypress/integration/featureFiles/overview.feature` was accidentally overwritten with TypeScript step definition code instead of proper Gherkin syntax. This error went undetected until runtime, requiring three separate commits (583e6c51f, c85e6035b, 627235b9b) to fix it a week later.

**Why This Matters:**
- The Kiali repository contains 53 .feature files with ~5,356 lines of Gherkin test specifications
- These files are critical BDD test definitions that describe expected system behavior
- Currently, there is NO validation to ensure .feature files contain valid Gherkin syntax
- There is NO protection against accidentally overwriting .feature files with code during merges
- Errors are only caught at test runtime, which is too late in the development cycle

**Desired Outcome:**
Add automated validation that:
1. Validates Gherkin syntax is correct
2. Enforces consistent formatting and style (critical for AI-generated scenarios)
3. Prevents different code from being committed in .feature files
4. Runs in pre-commit hooks (preferred by issue author)
5. Redundant validation could be executed before cypress execution

**AI Scenario Generation Context:**
The user plans to use AI agents to generate Gherkin scenarios. This requires **strict style enforcement** to ensure AI-generated content follows consistent formatting, proper indentation, naming conventions, and Gherkin best practices.

## Solution Approach

Implement a **defense-in-depth validation strategy** with two layers:
1. **Pre-commit validation** - catches issues before they're committed
2. **Pre-Cypress validation** - catches issues that bypass hooks, runs automatically before every Cypress test suite (both locally and in CI)

**Key Decision:** Use `gherkin-lint` - the industry-standard dedicated linter for Gherkin files. This provides:
- Comprehensive style rules (indentation, spacing, naming)
- Configurable validation for best practices
- Better error messages than basic syntax validation
- Essential for validating AI-generated scenarios with strict formatting requirements

## Implementation Steps

### Step 1: Add gherkin-lint Dependency

**File:** `frontend/package.json`

Add `gherkin-lint` to `devDependencies`:

```json
"gherkin-lint": "^4.2.4"
```

Run `yarn install` after adding the dependency.

### Step 2: Create gherkin-lint Configuration

**File:** `frontend/.gherkin-lintrc` (new file)

Create a strict configuration file optimized for AI-generated scenarios:

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

These rules enforce:
- Consistent 2-space indentation for scenarios, 4-space for steps
- No trailing spaces or excessive empty lines
- Proper naming (no unnamed features/scenarios)
- No duplicate names
- Required newline at end of file
- No empty files or backgrounds

### Step 3: Add npm Scripts

**File:** `frontend/package.json`

Add two new scripts to the `scripts` section:

```json
"validate:gherkin": "gherkin-lint cypress/integration/featureFiles/*.feature",
"validate:gherkin:staged": "git diff --cached --name-only --diff-filter=AM | grep -E '\\.feature$' | xargs -r gherkin-lint"
```

- `validate:gherkin` - validates all .feature files (for manual use and CI)
- `validate:gherkin:staged` - validates only staged .feature files (for pre-commit hook)

### Step 4: Update Pre-commit Hook

**File:** `frontend/package.json` (modify existing `pre-commit` script at line 88)

**Current:**
```json
"pre-commit": "yarn run pretty-quick --staged --no-restage --bail --pattern \"**/*.{ts,tsx,scss,json}\" && npm run lint:precommit && npm run format:precommit"
```

**Updated:**
```json
"pre-commit": "yarn run pretty-quick --staged --no-restage --bail --pattern \"**/*.{ts,tsx,scss,json}\" && npm run lint:precommit && npm run validate:gherkin:staged && npm run format:precommit"
```

This adds Gherkin validation between TypeScript linting and the format check.

### Step 5: Add Pre-Cypress Validation to Integration Test Runner

**File:** `hack/run-integration-tests.sh`

Rename `ensureCypressInstalled()` to `ensureCypressReady()` and add Gherkin validation to it. This function is called by all 14 frontend test suites, so a single change covers every Cypress execution path -- both locally and in CI.

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

Also rename all 14 call sites from `ensureCypressInstalled` to `ensureCypressReady`.

**Why this is better than a separate CI workflow step:**
- Runs everywhere Cypress runs -- locally via `hack/run-integration-tests.sh` and in every CI suite
- Acts as a natural gate: if `.feature` files are broken, don't waste time starting Cypress
- Single insertion point, no separate workflow file to maintain
- Still catches `--no-verify` bypasses because CI test suites all go through this function

### Step 6: Optional - Exclude .feature from Prettier

**File:** `frontend/.prettierignore` (modify if needed)

If Prettier starts attempting to format .feature files (it shouldn't currently), add:
```
*.feature
```

This is defensive - Prettier's current pattern `**/*.{ts,tsx,scss,json}` already excludes .feature files. Since `gherkin-lint` now handles .feature file formatting, we want to ensure Prettier doesn't interfere.

## Critical Files

The following files will be modified or created:

1. **NEW**: `frontend/.gherkin-lintrc` - gherkin-lint configuration with strict style rules
2. **MODIFY**: `frontend/package.json` - Add gherkin-lint dependency, add scripts, and update pre-commit hook
3. **MODIFY**: `hack/run-integration-tests.sh` - Rename `ensureCypressInstalled` → `ensureCypressReady`, add Gherkin validation
4. **OPTIONAL**: `frontend/.prettierignore` - Exclude .feature if needed

## Verification Plan

### Manual Testing

1. **Test that all existing .feature files pass validation:**
   ```bash
   # Run validation on all existing files - should PASS
   cd frontend && yarn validate:gherkin
   ```

2. **Test validation detects invalid Gherkin syntax:**
   ```bash
   # Create a file with invalid Gherkin (e.g., missing colon after Feature)
   echo "Feature Test Feature" > frontend/cypress/integration/featureFiles/test-syntax-error.feature
   
   # Run validation - should FAIL with syntax error
   cd frontend && yarn validate:gherkin
   
   # Clean up
   rm frontend/cypress/integration/featureFiles/test-syntax-error.feature
   ```

3. **Test validation detects style violations:**
   ```bash
   # Create a file with incorrect indentation
   cat > frontend/cypress/integration/featureFiles/test-style-error.feature << 'EOF'
Feature: Test Feature
Scenario: Bad indentation
Given I have bad indentation
EOF
   
   # Run validation - should FAIL with indentation error
   cd frontend && yarn validate:gherkin
   
   # Clean up
   rm frontend/cypress/integration/featureFiles/test-style-error.feature
   ```

4. **Test pre-commit hook blocks invalid files:**
   ```bash
   # Create an invalid file
   echo "Feature Test" > frontend/cypress/integration/featureFiles/test-invalid.feature
   
   # Try to commit - should be BLOCKED by pre-commit hook
   git add frontend/cypress/integration/featureFiles/test-invalid.feature
   git commit -m "test: should fail"
   
   # Clean up
   git reset HEAD frontend/cypress/integration/featureFiles/test-invalid.feature
   rm frontend/cypress/integration/featureFiles/test-invalid.feature
   ```

### Pre-Cypress Validation Testing

1. **Test that validation runs before Cypress:**
   ```bash
   # Introduce an invalid .feature file and run integration tests
   echo "Feature Test" > frontend/cypress/integration/featureFiles/test-invalid.feature
   
   # Run any test suite - should FAIL at the validation step before Cypress starts
   hack/run-integration-tests.sh --test-suite local --tests-only true
   
   # Clean up
   rm frontend/cypress/integration/featureFiles/test-invalid.feature
   ```

2. **Verify the rename didn't break anything:**
   ```bash
   # Grep for any remaining references to the old function name
   grep -r "ensureCypressInstalled" hack/run-integration-tests.sh
   # Should return nothing
   ```

### End-to-End Testing

1. Developer modifies a .feature file with valid Gherkin → commit succeeds
2. Developer accidentally overwrites a .feature file with TypeScript code → pre-commit hook blocks commit
3. Developer bypasses pre-commit hook (using `--no-verify`) → pre-Cypress validation catches the error before tests run
4. All existing Cypress tests continue to run successfully

## Success Criteria

- ✅ gherkin-lint successfully validates all 53 existing .feature files
- ✅ Validation detects invalid Gherkin syntax
- ✅ Validation enforces consistent style (indentation, spacing, naming)
- ✅ Pre-commit hook prevents committing invalid .feature files
- ✅ Pre-Cypress validation runs before every test suite (locally and in CI), blocking execution on invalid files
- ✅ Performance is acceptable (<500ms for all 53 files)
- ✅ Developers can manually run validation with `yarn validate:gherkin`
- ✅ AI-generated scenarios are validated for proper formatting and style
- ✅ The specific bug from PR #9151 (TypeScript code in .feature file) would be prevented (gherkin-lint will fail on invalid Gherkin syntax)

## Rollout Considerations

- **Single new devDependency** - adds `gherkin-lint` (industry-standard tool, ~100KB)
- **Backward compatible** - need to verify all existing .feature files pass strict validation (may require minor formatting fixes)
- **Fast execution** - validation runs in milliseconds, minimal impact on developer workflow
- **Clear error messages** - gherkin-lint provides detailed error messages with line numbers and rule names
- **Two-layer protection** - pre-commit catches issues early, pre-Cypress validation is the safety net
- **Manual validation** - developers can run `yarn validate:gherkin` to check files before committing
- **AI-ready** - strict style rules ensure AI-generated scenarios maintain consistent quality

## Alternative Approaches Considered

**Alternative 1: Custom validation script using @cucumber/gherkin**
- Pros: No new dependencies, lightweight
- Cons: Only validates syntax, no style enforcement, no formatting rules
- Decision: Rejected - insufficient for AI-generated scenarios which need strict style validation

**Alternative 2: Validate in Cypress preprocessor only**
- Pros: Catches errors at test runtime
- Cons: Too late in the development cycle, doesn't prevent commits
- Decision: Rejected - validation should happen earlier (pre-commit/CI)

**Alternative 3: Separate CI workflow step in build-frontend.yml**
- Pros: Runs independently of test execution
- Cons: Separate file to maintain, doesn't gate Cypress execution, runs even when no .feature files changed
- Decision: Rejected - pre-Cypress validation in `hack/run-integration-tests.sh` is more targeted and covers all execution paths with a single change

**Alternative 4: GitHub Actions only (no pre-commit)**
- Pros: Simpler, no pre-commit overhead
- Cons: Catches errors much later in workflow, wastes developer and CI time
- Decision: Rejected - pre-commit validation provides better developer experience

**Alternative 5: Use cucumber-lint instead of gherkin-lint**
- Pros: Similar functionality
- Cons: gherkin-lint is more actively maintained and widely used
- Decision: Rejected - gherkin-lint is the current industry standard
