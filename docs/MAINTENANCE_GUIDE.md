# Documentation Maintenance Guide

This guide provides processes and templates for keeping the Kraken documentation system current and accurate as the codebase evolves.

## 📋 Maintenance Responsibilities

### When Code Changes, Documentation Must Change

**MANDATORY: Every code change requires corresponding documentation updates.**

| Code Change Type | Documentation Updates Required |
|-----------------|-------------------------------|
| **New API Endpoint** | Update API docs, add to cross-reference, update related components |
| **Component Props Change** | Update component docs, usage examples, integration patterns |
| **New WebSocket Event** | Update WebSocket events, related components, state management |
| **Database Schema Change** | Update module docs, API docs, type definitions |
| **New Permission** | Update RBAC docs, component examples, cross-reference |
| **Hook Signature Change** | Update hook docs, component usage, integration examples |

---

## 🔄 Maintenance Workflows

### 1. Adding New Features

#### Backend Feature Addition
```bash
# 1. Implement the feature in backend
# 2. Update documentation (use templates)

# Create module documentation
cp docs/templates/module.template.md docs/modules/[category]/[feature].md

# Create API documentation  
cp docs/templates/api.template.md docs/api/[feature].md

# Update WebSocket events if needed
# Edit docs/api/websocket-events.md

# Update cross-reference
# Edit docs/CROSS_REFERENCE.md
```

#### Frontend Feature Addition
```bash
# 1. Implement the feature in frontend
# 2. Update documentation (use templates)

# Create component documentation
cp docs/templates/component.template.md docs/components/[category]/[Component].md

# Create hook documentation if needed
cp docs/templates/hook.template.md docs/hooks/[hookName].md

# Create state documentation
cp docs/templates/slice.template.md docs/state/[feature]Api.md

# Update cross-reference
# Edit docs/CROSS_REFERENCE.md
```

### 2. Modifying Existing Features

#### API Endpoint Changes
1. **Update API Documentation**
   - Modify endpoint signatures in `docs/api/[controller].md`
   - Update request/response examples
   - Update error handling patterns
   - Update RBAC permissions if changed

2. **Update Related Documentation**
   - Frontend state management docs
   - Component usage examples
   - Hook documentation that uses the API
   - Cross-reference links

3. **Validation Checklist**
   - [ ] API endpoint documentation updated
   - [ ] Frontend integration examples updated
   - [ ] Error handling documented
   - [ ] Cross-reference updated
   - [ ] Usage examples tested

#### Component Interface Changes
1. **Update Component Documentation**
   - Modify props interface in component docs
   - Update usage examples
   - Update integration patterns

2. **Update Dependent Documentation**
   - Parent components that use this component
   - Hooks that integrate with this component  
   - State management docs
   - Cross-reference entries

3. **Validation Checklist**
   - [ ] Props interface updated
   - [ ] Usage examples reflect new interface
   - [ ] Dependent components documented
   - [ ] Integration patterns updated

### 3. WebSocket Event Changes

#### Adding New Events
1. **Update WebSocket Events Documentation**
   ```markdown
   # Add to docs/api/websocket-events.md
   
   #### NEW_EVENT_NAME
   **Event:** `NEW_EVENT_NAME`
   **Purpose:** [Description]
   **Payload:** [TypeScript interface]
   **Usage:** [Frontend and backend examples]
   ```

2. **Update Cross-Reference**
   - Add to event flow diagrams
   - Link to related components
   - Update real-time data flow sections

3. **Update Related Documentation**
   - Backend gateway documentation
   - Frontend hook documentation
   - Component integration examples

---

## 📝 Documentation Templates Usage

### Using Templates for New Documentation

#### 1. Component Documentation
```bash
# Copy template
cp docs/templates/component.template.md docs/components/[feature]/[ComponentName].md

# Replace all placeholders:
# [ComponentName] → ActualComponentName
# [path] → actual/path/to/component  
# [feature] → feature name
# Fill in real props, usage examples, etc.
```

#### 2. API Documentation
```bash
# Copy template
cp docs/templates/api.template.md docs/api/[controller-name].md

# Replace all placeholders:
# [ControllerName] → ActualControllerName
# [route-prefix] → actual-route-prefix
# [entity] → entity name
# Fill in real endpoints, payloads, examples
```

#### 3. Module Documentation
```bash
# Copy template
cp docs/templates/module.template.md docs/modules/[category]/[module-name].md

# Replace all placeholders:
# [ModuleName] → ActualModuleName
# [path] → actual/path/to/module
# [Entity] → entity/model name
# Fill in real services, methods, DTOs
```

### Template Customization Guidelines

1. **Replace ALL Placeholder Text** - No `[placeholder]` text should remain
2. **Add Real Examples** - Use actual code from the codebase
3. **Include Integration Patterns** - Show how it connects to other parts
4. **Cross-Reference Links** - Add links to related documentation
5. **Test Examples** - Ensure code examples are current and working

---

## 🔍 Quality Assurance Process

### Documentation Review Checklist

#### Before Submitting Documentation Changes
- [ ] **Accuracy** - All information matches current code implementation
- [ ] **Completeness** - All required sections filled out
- [ ] **Examples** - Code examples are working and current
- [ ] **Cross-References** - Links to related documentation added
- [ ] **Formatting** - Consistent with existing documentation style
- [ ] **Testing** - Examples tested in actual development environment

#### Peer Review Process
1. **Technical Accuracy** - Does the documentation match the implementation?
2. **Clarity** - Is the documentation clear and understandable?
3. **Completeness** - Are all important aspects covered?
4. **Integration** - Are cross-references and relationships documented?

### Automated Validation (Recommendations)

#### Git Pre-commit Hooks
```bash
#!/bin/sh
# .git/hooks/pre-commit
# Check for documentation updates when code changes

# Check if backend code changed without API doc updates
if git diff --cached --name-only | grep -E "backend/src.*\.(ts|js)$" > /dev/null; then
    echo "Backend code changes detected. Have you updated API documentation?"
fi

# Check if frontend components changed without component doc updates
if git diff --cached --name-only | grep -E "frontend/src/components.*\.tsx?$" > /dev/null; then
    echo "Component changes detected. Have you updated component documentation?"
fi
```

#### Documentation Link Validation
```bash
#!/bin/bash
# scripts/validate-docs.sh
# Validate internal documentation links

find docs -name "*.md" -exec grep -l "\[.*\](.*\.md)" {} \; | while read file; do
    grep -o "\[.*\]([^)]*\.md[^)]*)" "$file" | while read link; do
        path=$(echo "$link" | sed 's/.*](\([^)]*\)).*/\1/')
        if [[ ! -f "docs/$path" ]]; then
            echo "Broken link in $file: $path"
        fi
    done
done
```

---

## 📊 Documentation Health Monitoring

### Regular Maintenance Tasks

#### Weekly Tasks
- [ ] Review recent code changes for missing documentation updates
- [ ] Check for broken internal links in documentation
- [ ] Validate code examples in documentation
- [ ] Update cross-reference document with new relationships

#### Monthly Tasks
- [ ] Comprehensive documentation review for accuracy
- [ ] Update architecture documentation with new patterns
- [ ] Review and update development guidelines
- [ ] Check for outdated examples and update them

#### Quarterly Tasks
- [ ] Full documentation audit against current codebase
- [ ] Update documentation templates based on new patterns
- [ ] Review and improve documentation structure
- [ ] Gather developer feedback on documentation quality

### Documentation Metrics

#### Tracking Documentation Coverage
```bash
#!/bin/bash
# scripts/doc-coverage.sh
# Check documentation coverage

echo "=== Backend Module Documentation Coverage ==="
backend_modules=$(find backend/src -name "*.module.ts" | wc -l)
documented_modules=$(find docs/modules -name "*.md" | wc -l)
echo "Modules: $documented_modules/$backend_modules documented"

echo "=== Frontend Component Documentation Coverage ==="
components=$(find frontend/src/components -name "*.tsx" | wc -l)
documented_components=$(find docs/components -name "*.md" | wc -l)
echo "Components: $documented_components/$components documented"

echo "=== API Endpoint Documentation Coverage ==="
controllers=$(find backend/src -name "*.controller.ts" | wc -l)
documented_apis=$(find docs/api -name "*.md" | grep -v README | wc -l)
echo "APIs: $documented_apis/$controllers documented"
```

---

## 🚨 Common Documentation Debt Issues

### Anti-Patterns to Avoid

#### 1. **Placeholder Documentation**
```markdown
❌ BAD:
## Usage
TODO: Add usage examples

✅ GOOD:
## Usage
```tsx
import { UserProfile } from '@/components/users/UserProfile';

function ProfilePage() {
  return <UserProfile userId={currentUser.id} />;
}
```
```

#### 2. **Outdated Examples**
```markdown
❌ BAD:
// Using old API that was changed 6 months ago
const { data } = useGetUsersQuery();

✅ GOOD:
// Current API with proper parameters
const { data: users } = useGetUsersQuery({ page: 1, limit: 20 });
```

#### 3. **Missing Cross-References**
```markdown
❌ BAD:
This component handles user authentication.

✅ GOOD:
This component handles user authentication.

**Related Documentation:**
- [Auth API](../api/auth.md)
- [useAuth Hook](../hooks/useAuth.md)
- [Auth Module](../modules/auth/auth.md)
```

### Debt Reduction Strategies

#### 1. **Incremental Updates**
- Update documentation as you work on related features
- Fix one outdated example each day
- Add cross-references when you encounter missing links

#### 2. **Batch Updates**
- Schedule dedicated documentation update sessions
- Focus on one feature area at a time
- Update entire documentation chains (API → Component → Hook → State)

#### 3. **Developer Responsibility**
- Each developer maintains documentation for their features
- Documentation updates are part of feature completion
- Code reviews include documentation review

---

## 🎯 Documentation Success Metrics

### Quality Indicators

#### High-Quality Documentation Characteristics
- [ ] **Accurate** - Matches current implementation
- [ ] **Complete** - Covers all important aspects  
- [ ] **Current** - Updated with recent changes
- [ ] **Clear** - Easy to understand and follow
- [ ] **Connected** - Proper cross-references
- [ ] **Practical** - Includes working examples

#### Developer Experience Metrics
- **Time to Understand** - How quickly can a new developer understand a component/API?
- **Integration Success** - Can developers successfully integrate using the documentation?
- **Question Frequency** - Are developers asking questions that should be answered in docs?

### Continuous Improvement

#### Feedback Collection
```bash
# Add to component/API documentation
## Feedback
Having trouble with this documentation? 
[Open an issue](https://github.com/user/kraken/issues) or 
[suggest improvements](https://github.com/user/kraken/pulls)
```

#### Documentation Evolution
- Track which documentation gets updated most frequently
- Identify patterns in developer questions
- Evolve templates based on common needs
- Improve cross-reference system based on usage patterns

---

## 🔧 Tools and Automation

### Recommended Tools

#### Documentation Generation
```bash
# Generate API documentation from OpenAPI spec
npx @redocly/cli build-docs backend/openapi.yaml

# Generate component documentation from TypeScript
npx typedoc --out docs/generated frontend/src/components
```

#### Link Validation
```bash
# Install markdown link checker
npm install -g markdown-link-check

# Check documentation links
find docs -name "*.md" -exec markdown-link-check {} \;
```

#### Documentation Formatting
```bash
# Install prettier for markdown
npm install -g prettier

# Format all documentation
prettier --write "docs/**/*.md"
```

### Integration with Development Workflow

#### VS Code Extensions
- **Markdown All in One** - Better markdown editing
- **Markdown Preview Enhanced** - Live preview with diagrams
- **Auto Markdown TOC** - Automatic table of contents

#### Documentation Development Server
```bash
# Serve documentation locally with hot reload
npx docsify serve docs

# Or use a simple static server
npx http-server docs
```

This maintenance guide ensures that the Kraken documentation system remains a valuable, current, and accurate resource for all developers working with the codebase.