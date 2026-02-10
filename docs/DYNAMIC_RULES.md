# Dynamic Rules Management for Enterprise CI/CD

## Problem Statement

Currently, rules are hardcoded in `server/engine/pattern-rules.ts`. To update rules across 1000 pipelines, you need to:
1. Update the TypeScript file
2. Redeploy the server (if centralized)
3. OR update the cloned repo URL in all 1000 workflow files

This is not scalable for enterprise deployments.

## Solution Options

### Option 1: Centralized Rules API (Recommended for Scale)

Deploy a **centralized Code Review server** that all pipelines call, with a rules management API.

#### Architecture:
```
┌─────────────────────────────────────────────────────────┐
│         Centralized Code Review Server                  │
│         https://code-review.company.com                  │
│                                                          │
│  ┌────────────────┐      ┌──────────────────┐          │
│  │  Rules API     │◄────►│  Rules Database  │          │
│  │  /api/rules    │      │  (PostgreSQL)    │          │
│  └────────────────┘      └──────────────────┘          │
│           ▲                                             │
│           │                                             │
│  ┌────────┴────────┐                                   │
│  │  Review API     │                                   │
│  │  /api/review    │                                   │
│  └─────────────────┘                                   │
└─────────────────────────────────────────────────────────┘
           ▲        ▲        ▲
           │        │        │
    ┌──────┴───┬────┴───┬────┴──────┐
    │  Repo 1  │ Repo 2 │  Repo 1000│
    │  GHA     │  GHA   │   GHA     │
    └──────────┴────────┴───────────┘
    All pipelines call the same server
    Updates affect all repos instantly
```

#### Implementation Steps:

1. **Create Rules Database**
```sql
CREATE TABLE rules (
  id VARCHAR(50) PRIMARY KEY,
  name VARCHAR(255) NOT NULL,
  enabled BOOLEAN DEFAULT true,
  pattern TEXT,
  pattern_flags VARCHAR(10),
  severity VARCHAR(20) NOT NULL,
  category VARCHAR(50) NOT NULL,
  message TEXT NOT NULL,
  suggestion TEXT NOT NULL,
  languages JSONB NOT NULL,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW(),
  created_by VARCHAR(100)
);

CREATE INDEX idx_rules_enabled ON rules(enabled);
CREATE INDEX idx_rules_languages ON rules USING GIN(languages);
```

2. **Add Rules Management API**
```typescript
// server/routes/rules-api.ts
import express from 'express';
import { db } from '../config/database';

const router = express.Router();

// GET /api/rules - List all rules
router.get('/rules', async (req, res) => {
  const { language, enabled } = req.query;
  let query = 'SELECT * FROM rules WHERE 1=1';
  const params: any[] = [];
  
  if (language) {
    query += ' AND languages @> $1';
    params.push(JSON.stringify([language]));
  }
  if (enabled !== undefined) {
    query += ` AND enabled = $${params.length + 1}`;
    params.push(enabled === 'true');
  }
  
  const result = await db.query(query, params);
  res.json(result.rows);
});

// POST /api/rules - Create new rule
router.post('/rules', async (req, res) => {
  const { id, name, pattern, severity, category, message, suggestion, languages } = req.body;
  
  const result = await db.query(
    `INSERT INTO rules (id, name, pattern, severity, category, message, suggestion, languages)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
     RETURNING *`,
    [id, name, pattern, severity, category, message, suggestion, JSON.stringify(languages)]
  );
  
  res.status(201).json(result.rows[0]);
});

// PUT /api/rules/:id - Update rule
router.put('/rules/:id', async (req, res) => {
  const { id } = req.params;
  const { name, pattern, enabled, severity, category, message, suggestion, languages } = req.body;
  
  const result = await db.query(
    `UPDATE rules SET
      name = COALESCE($2, name),
      pattern = COALESCE($3, pattern),
      enabled = COALESCE($4, enabled),
      severity = COALESCE($5, severity),
      category = COALESCE($6, category),
      message = COALESCE($7, message),
      suggestion = COALESCE($8, suggestion),
      languages = COALESCE($9, languages),
      updated_at = NOW()
     WHERE id = $1
     RETURNING *`,
    [id, name, pattern, enabled, severity, category, message, suggestion, languages ? JSON.stringify(languages) : null]
  );
  
  if (result.rows.length === 0) {
    return res.status(404).json({ error: 'Rule not found' });
  }
  
  res.json(result.rows[0]);
});

// DELETE /api/rules/:id - Delete rule
router.delete('/rules/:id', async (req, res) => {
  const { id } = req.params;
  const result = await db.query('DELETE FROM rules WHERE id = $1 RETURNING id', [id]);
  
  if (result.rows.length === 0) {
    return res.status(404).json({ error: 'Rule not found' });
  }
  
  res.status(204).send();
});

// POST /api/rules/bulk-update - Update multiple rules
router.post('/rules/bulk-update', async (req, res) => {
  const { rule_ids, updates } = req.body; // updates: { enabled: false } etc
  
  const fields = Object.keys(updates).map((key, i) => `${key} = $${i + 2}`).join(', ');
  const values = [rule_ids, ...Object.values(updates)];
  
  await db.query(
    `UPDATE rules SET ${fields}, updated_at = NOW() WHERE id = ANY($1)`,
    values
  );
  
  res.json({ message: 'Rules updated', count: rule_ids.length });
});

export default router;
```

3. **Modify Review API to Use Database Rules**
```typescript
// server/engine/pattern-rules.ts - Add dynamic loading
import { db } from '../config/database';

export async function getActiveRules(language?: string): Promise<PatternRule[]> {
  let query = 'SELECT * FROM rules WHERE enabled = true';
  const params: any[] = [];
  
  if (language) {
    query += ' AND languages @> $1';
    params.push(JSON.stringify([language]));
  }
  
  const result = await db.query(query, params);
  
  return result.rows.map(row => ({
    id: row.id,
    name: row.name,
    enabled: row.enabled,
    pattern: row.pattern ? new RegExp(row.pattern, row.pattern_flags || '') : undefined,
    severity: row.severity,
    category: row.category,
    message: row.message,
    suggestion: row.suggestion,
    languages: row.languages,
  }));
}
```

4. **Update Frontend to Use API**
```typescript
// src/hooks/useRules.ts - Replace localStorage with API calls
export function useRules() {
  const [rules, setRules] = useState<ValidationStandards>({});
  const [loading, setLoading] = useState(true);
  
  useEffect(() => {
    loadRulesFromAPI();
  }, []);
  
  const loadRulesFromAPI = async () => {
    const response = await fetch('/api/rules');
    const data = await response.json();
    
    // Group rules by language
    const grouped = data.reduce((acc, rule) => {
      rule.languages.forEach(lang => {
        if (!acc[lang]) acc[lang] = [];
        acc[lang].push(rule);
      });
      return acc;
    }, {});
    
    setRules(grouped);
    setLoading(false);
  };
  
  const addRule = async (group: string, rule: ValidationRule) => {
    await fetch('/api/rules', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(rule),
    });
    await loadRulesFromAPI();
  };
  
  // ... similar for update, delete, toggle
}
```

5. **GitHub Actions Uses Centralized API**
```yaml
# All 1000 workflows use the same centralized server
- name: Run Code Review Gate
  env:
    ANTHROPIC_API_KEY: ${{ secrets.ANTHROPIC_API_KEY }}
    CODE_REVIEW_API_URL: "https://code-review.company.com/api"
  run: |
    npx tsx ci-review.ts --threshold 75
```

#### Benefits:
✅ **Update rules once** → affects all 1000 pipelines instantly  
✅ **No workflow file changes** needed  
✅ **Centralized audit log** of rule changes  
✅ **Role-based access control** for rule management  
✅ **Version history** for rules  

---

### Option 2: Git-Based Rules Configuration

Store rules in a **centralized Git repository** that pipelines fetch at runtime.

#### Architecture:
```
┌─────────────────────────────────────┐
│  Rules Repository                   │
│  github.com/company/code-review-rules│
│                                     │
│  rules/                             │
│    ├── pyspark.json                 │
│    ├── scala.json                   │
│    ├── sql.json                     │
│    └── terraform.json               │
└─────────────────────────────────────┘
          ▲        ▲        ▲
          │        │        │
   ┌──────┴───┬────┴───┬────┴──────┐
   │  Repo 1  │ Repo 2 │  Repo 1000│
   │  GHA     │  GHA   │   GHA     │
   └──────────┴────────┴───────────┘
   Each pipeline clones rules repo
```

#### Implementation:

1. **Create Rules Repository**
```json
// rules/pyspark.json
[
  {
    "id": "pyspark-001",
    "name": "Missing Docstrings",
    "enabled": true,
    "severity": "medium",
    "category": "code-structure",
    "message": "Missing docstrings for documentation",
    "suggestion": "Add docstrings: \"\"\"Process data.\"\"\"",
    "languages": ["pyspark", "python"],
    "checkFunction": "return !code.includes('\"\"\"') && !code.includes(\"'''\")"
  }
]
```

2. **Modify Server to Load Rules from File**
```typescript
// server/engine/pattern-rules.ts
import fs from 'fs';
import path from 'path';

const RULES_DIR = process.env.RULES_DIR || './rules';

export function loadRulesFromFiles(): PatternRule[] {
  const rules: PatternRule[] = [];
  const files = fs.readdirSync(RULES_DIR).filter(f => f.endsWith('.json'));
  
  for (const file of files) {
    const content = fs.readFileSync(path.join(RULES_DIR, file), 'utf8');
    const fileRules = JSON.parse(content);
    
    fileRules.forEach(r => {
      if (r.pattern) {
        r.pattern = new RegExp(r.pattern.source || r.pattern, r.pattern.flags || '');
      }
      if (r.checkFunction) {
        r.checkFunction = new Function('code', r.checkFunction);
      }
      rules.push(r);
    });
  }
  
  return rules;
}
```

3. **GitHub Actions Workflow**
```yaml
jobs:
  code-review:
    runs-on: ubuntu-latest
    steps:
      - name: Checkout code
        uses: actions/checkout@v3
      
      - name: Checkout rules repository
        uses: actions/checkout@v3
        with:
          repository: company/code-review-rules
          token: ${{ secrets.RULES_REPO_TOKEN }}
          path: rules
      
      - name: Run Code Review
        env:
          RULES_DIR: ./rules
          ANTHROPIC_API_KEY: ${{ secrets.ANTHROPIC_API_KEY }}
        run: |
          npm install
          npm run server &
          sleep 10
          npx tsx scripts/ci-review.ts --threshold 75
```

#### Benefits:
✅ **Git version control** for rules  
✅ **Pull request workflow** for rule changes  
✅ **Branch protection** prevents unauthorized changes  
✅ **Works with existing Git infrastructure**  

---

### Option 3: Environment Variable Configuration

Store frequently updated rules as **environment variables** in CI/CD platform.

```yaml
# GitHub Organization Variables
REVIEW_THRESHOLD=75
DISABLED_RULES=pyspark-002,scala-003,sql-009
CRITICAL_ONLY_MODE=false
```

```typescript
// Parse disabled rules from env
const disabledRules = (process.env.DISABLED_RULES || '').split(',');
const activeRules = allRules.filter(r => !disabledRules.includes(r.id));
```

#### Benefits:
✅ **Quick toggle** without code changes  
✅ **Organization-level** or repo-level control  
❌ **Limited** - only works for enable/disable, not rule content  

---

## Recommendation for 1000 Pipelines

Use **Option 1 (Centralized Rules API)** because:

1. **Zero workflow changes**: Set API URL once in org secrets
2. **Instant updates**: Change rules → affects all repos immediately
3. **Audit trail**: Track who changed what and when
4. **Advanced features**: 
   - Rule versioning
   - A/B testing different rule sets
   - Environment-specific rules (dev/staging/prod)
   - Scheduled rule enablement
5. **Cost efficient**: One server for 1000 repos vs 1000 ephemeral servers

### Migration Path:
1. Deploy centralized server with initial rules
2. Add database and Rules API
3. Update org secrets: `CODE_REVIEW_API_URL=https://code-review.company.com/api`
4. Update workflows to use centralized API (one-time change)
5. Future rule updates happen via Rules Management UI, no workflow changes needed
