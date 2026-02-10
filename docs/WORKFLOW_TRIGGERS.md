# Code Review Workflow Triggers Best Practices

## Question: When Should Code Review Run?

### ✅ Recommended: On Pull Request Events

Run code review when a **Pull Request is opened or updated** targeting your protected branches (develop, main).

```yaml
name: AI Code Review Gate

on:
  pull_request:
    branches: [develop, main]
    types: [opened, synchronize, reopened]

jobs:
  code-review:
    runs-on: ubuntu-latest
    steps:
      # ... review steps
```

### ❌ Not Recommended: On Every Feature Branch Push

Do NOT trigger on every push to feature branches:

```yaml
# DON'T DO THIS
on:
  push:
    branches: ['feature/**', 'bugfix/**']
```

## Why Pull Request Triggers Are Better

| Aspect | Pull Request Trigger | Push to Feature Branch |
|--------|---------------------|------------------------|
| **Cost** | Only when code is ready for review | Every WIP commit (expensive) |
| **Developer Experience** | Doesn't interrupt local development | Slows down iterative work |
| **Quality Gate** | Acts as proper merge gate | Runs too early in process |
| **Changed Files** | Easy to detect PR diff | Harder to determine scope |
| **GitHub Integration** | Shows status on PR checks | Separate from PR flow |
| **Scalability** | Efficient for 1000 repos | High volume of unnecessary runs |

## Trigger Strategy Comparison

### Strategy 1: PR-Only (Recommended for Most Teams)

**When**: PR opened/updated targeting develop or main

```yaml
on:
  pull_request:
    branches: [develop, main]
```

**Use Case**: 
- Standard development workflow
- Feature branches → develop → main
- Quality gate before merge

**Benefits**:
- ✅ Cost-effective
- ✅ Only reviews ready code
- ✅ Blocks bad PRs from merging
- ✅ Developer-friendly (no interruption during development)

---

### Strategy 2: PR + Post-Merge Validation

**When**: PR events + pushes to protected branches

```yaml
on:
  pull_request:
    branches: [develop, main]
  push:
    branches: [main, develop]
```

**Use Case**:
- Teams that allow direct pushes to develop
- Want validation even after merge
- Post-merge audit trail

**Benefits**:
- ✅ Catches issues from direct commits
- ✅ Verifies merged code still passes
- ⚠️ More expensive (double runs)

---

### Strategy 3: Feature Branch Push (Not Recommended)

**When**: Every push to feature branches

```yaml
# NOT RECOMMENDED FOR PRODUCTION
on:
  push:
    branches: [feature/**, bugfix/**]
```

**Use Case**:
- Early detection during development
- Continuous feedback loop

**Drawbacks**:
- ❌ Very expensive at scale (1000 repos × multiple commits)
- ❌ Runs on WIP/incomplete code
- ❌ Interrupts developer workflow
- ❌ High API costs
- ❌ Not a proper quality gate

---

### Strategy 4: Scheduled + Manual

**When**: On schedule or manual trigger

```yaml
on:
  schedule:
    - cron: '0 2 * * 1'  # Weekly Monday 2am
  workflow_dispatch:      # Manual trigger
```

**Use Case**:
- Periodic audits of entire codebase
- Manual reviews before releases
- Batch processing

---

## GitHub Actions Trigger Options

### Pull Request Types

```yaml
on:
  pull_request:
    branches: [develop, main]
    types: 
      - opened       # PR created
      - synchronize  # New commits pushed to PR
      - reopened     # Closed PR reopened
      - ready_for_review  # Draft → Ready
```

**Recommended**: Include `opened`, `synchronize`, and `reopened`

**Optional**: Add `ready_for_review` if you use draft PRs

### Branch Patterns

```yaml
# Target specific branches
on:
  pull_request:
    branches: 
      - main
      - develop
      - 'release/**'
```

### Path Filters (Cost Optimization)

Only run review if specific files changed:

```yaml
on:
  pull_request:
    branches: [develop, main]
    paths:
      - '**.py'
      - '**.scala'
      - '**.sql'
      - '**.tf'
      - '!docs/**'       # Exclude docs
      - '!**/*.md'       # Exclude markdown
```

**Use Case**: Skip reviews for documentation-only changes

---

## GitLab CI Equivalent

```yaml
code_review_gate:
  stage: review
  only:
    - merge_requests  # Only on MR creation/update
  except:
    - schedules
  rules:
    - if: '$CI_MERGE_REQUEST_TARGET_BRANCH == "develop"'
    - if: '$CI_MERGE_REQUEST_TARGET_BRANCH == "main"'
```

---

## Real-World Recommendation

For **1000 pipelines**, use this configuration:

```yaml
name: Code Review Quality Gate

on:
  pull_request:
    branches: [develop, main]
    types: [opened, synchronize, reopened]
    paths:  # Only run for code files
      - '**.py'
      - '**.scala'
      - '**.sql'
      - '**.tf'

jobs:
  code-review:
    # Prevent duplicate runs
    if: github.event.pull_request.draft == false
    
    runs-on: ubuntu-latest
    
    steps:
      - uses: actions/checkout@v3
        with:
          fetch-depth: 0  # Full history for accurate diffs
      
      - name: Run Code Review Gate
        env:
          ANTHROPIC_API_KEY: ${{ secrets.ANTHROPIC_API_KEY }}
        run: |
          # Only review changed files in PR
          CHANGED_FILES=$(git diff --name-only origin/${{ github.base_ref }}...HEAD | grep -E '\.(py|scala|sql|tf)$' || true)
          
          if [ -z "$CHANGED_FILES" ]; then
            echo "No code files changed, skipping review"
            exit 0
          fi
          
          npx tsx scripts/ci-review.ts \
            --threshold 75 \
            --fail-on-critical \
            $CHANGED_FILES
```

### Key Features:
1. ✅ **Triggers**: PR events only (not feature branch pushes)
2. ✅ **Target**: develop and main branches
3. ✅ **Path Filter**: Only code files (saves costs)
4. ✅ **Draft PR Skip**: Doesn't run on draft PRs
5. ✅ **Changed Files Only**: Reviews diff, not entire codebase
6. ✅ **Early Exit**: Skips if no relevant files changed

---

## Cost Analysis (1000 Repos)

### Scenario 1: Pull Request Trigger Only
- **Frequency**: ~5 PRs per repo per week
- **Total Runs**: 1000 repos × 5 PRs = **5,000 runs/week**
- **Cost**: $200-500/week (depending on API usage)

### Scenario 2: Feature Branch Push
- **Frequency**: ~20 commits per repo per week (including WIP)
- **Total Runs**: 1000 repos × 20 commits = **20,000 runs/week**
- **Cost**: $800-2000/week (4x more expensive)

### Recommendation
Use **Pull Request triggers** to reduce costs by 75% while providing better developer experience.

---

## Summary

| Question | Answer |
|----------|--------|
| **When to trigger?** | On Pull Request events (opened, synchronized) |
| **Target branches?** | develop, main (protected branches) |
| **Run on feature pushes?** | ❌ No - too expensive and interrupts workflow |
| **Run on main pushes?** | Optional - for post-merge validation |
| **Path filters?** | ✅ Yes - only review code files |
| **Skip drafts?** | ✅ Yes - wait until ready for review |
| **Review entire repo?** | ❌ No - only changed files in PR |

**Golden Rule**: Run code review as a quality gate when code is ready for human review (PR opened), not during active development (feature branch pushes).
