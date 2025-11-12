<!--
SYNC IMPACT REPORT
==================
Version Change: [NEW] → 1.0.0
Rationale: Initial constitution for Pantrie project

Core Principles Defined:
- I. Specification-First: All features require written specs before implementation
- II. Test-First Development: TDD mandatory with tests before code
- III. Simplicity & YAGNI: Start simple, avoid over-engineering
- IV. Observability: Comprehensive logging and debugging support
- V. User-Centric Design: Food/recipe features must solve real user problems

Sections Added:
- Core Principles (5 principles)
- Technical Standards
- Quality Assurance
- Governance

Templates Updated:
- ✅ plan-template.md: Constitution Check section updated with 5 principles and food domain checklist
- ✅ spec-template.md: User scenarios and requirements template supports Specification-First principle
- ✅ tasks-template.md: Test-first structure and user story organization align with principles
- ✅ Commands: All command files maintain generic references (no agent-specific hardcoding)

Deferred Items: None

Created: 2025-11-12
-->

# Pantrie Constitution

## Core Principles

### I. Specification-First

Every feature MUST have a written specification before any implementation begins.

**Requirements**:
- All features begin with `/speckit.specify` to create spec.md
- Specifications MUST include user scenarios with acceptance criteria
- Requirements MUST be clear, testable, and technology-agnostic
- Unclear requirements MUST be marked as "NEEDS CLARIFICATION"
- No code may be written until specification is reviewed and approved

**Rationale**: Specifications ensure shared understanding between stakeholders and developers, reduce rework, and provide a clear success criteria. For a food/recipe management system, this prevents building features users don't need.

### II. Test-First Development (NON-NEGOTIABLE)

TDD is mandatory: Tests MUST be written, reviewed, confirmed to fail, then implementation proceeds.

**Requirements**:
- Tests written before implementation code
- User MUST approve test coverage and cases before implementation
- Tests MUST fail initially (Red phase)
- Implementation makes tests pass (Green phase)
- Refactor with passing tests (Refactor phase)
- Contract tests required for API boundaries
- Integration tests required for multi-component user journeys

**Rationale**: TDD ensures code correctness, prevents regressions, and serves as living documentation. For food/recipe features involving data integrity (ingredients, measurements, dietary restrictions), tests are critical for safety and reliability.

### III. Simplicity & YAGNI

Start simple. Implement only what is needed now. Avoid over-engineering and premature abstraction.

**Requirements**:
- Solutions MUST be the simplest that solve the stated problem
- Complexity requires written justification in plan.md Complexity Tracking table
- YAGNI principle: "You Aren't Gonna Need It" - no speculative features
- Prefer direct solutions over abstract frameworks until third use case
- Refactor toward abstraction only when patterns emerge from actual use

**Rationale**: Simple code is maintainable, understandable, and less bug-prone. Food/recipe management has inherent complexity (measurements, conversions, dietary needs) - code simplicity keeps this manageable.

### IV. Observability

All features MUST be debuggable and observable through comprehensive logging and error handling.

**Requirements**:
- Structured logging at key decision points and state changes
- Error messages MUST be actionable (what failed, why, how to fix)
- User-facing errors MUST be clear and non-technical
- System errors MUST include context for debugging (IDs, state, timestamps)
- All external integrations MUST log requests/responses (sanitized)
- Performance-critical paths MUST include timing instrumentation

**Rationale**: When users report recipe calculation errors or missing ingredients, observability enables rapid diagnosis. Food safety and dietary restriction compliance demand audit trails.

### V. User-Centric Design

Features MUST solve real user problems in the food/recipe management domain.

**Requirements**:
- Every feature MUST map to specific user scenarios in spec.md
- User stories MUST be prioritized (P1, P2, P3) by value
- Each user story MUST be independently testable and deliverable
- Success criteria MUST be measurable and user-focused
- Edge cases MUST consider food domain specifics (allergens, measurements, substitutions)

**Rationale**: Pantrie exists to help users manage food, recipes, and meal planning. Features must demonstrably improve user workflows - inventory tracking, recipe discovery, meal planning, or nutrition management.

## Technical Standards

### Code Quality

- Clear, descriptive naming following language conventions
- Functions/methods under 50 lines (extract if longer)
- Files under 500 lines (split by responsibility if longer)
- No magic numbers - use named constants
- Comments explain "why", not "what"

### Data Integrity

Food/recipe data has domain-specific requirements:

- Measurements MUST use standard units (metric/imperial) with explicit conversion
- Ingredient data MUST preserve allergen and dietary information
- Recipe scaling MUST maintain proportional relationships
- Dates MUST use ISO 8601 format (YYYY-MM-DD)
- Nutrition data MUST cite sources and calculation methods

### Security

- User input MUST be validated and sanitized
- Sensitive data (dietary restrictions, allergies) MUST be protected
- API endpoints MUST have authentication/authorization
- No credentials or secrets in code or version control
- Dependencies MUST be scanned for vulnerabilities

## Quality Assurance

### Testing Requirements

- Unit tests for business logic and calculations (especially conversions)
- Integration tests for user journeys spanning multiple components
- Contract tests for API boundaries
- Edge case tests for domain boundaries (zero amounts, missing ingredients)
- Test coverage target: 80% minimum for critical paths

### Code Review

- All changes require review before merge
- Reviewer MUST verify constitution compliance
- Complexity additions MUST be justified in plan.md
- Breaking changes require migration plan
- Tests MUST be reviewed and approved before implementation

### Documentation

- Public APIs MUST have usage examples
- Complex algorithms MUST have explanation comments
- Database schema changes MUST be documented
- User-facing features MUST have user guide updates

## Governance

### Authority

This constitution supersedes all other development practices and guidelines. In conflicts, constitution principles take precedence.

### Amendments

Constitution changes require:

1. Written proposal documenting change rationale
2. Impact analysis on existing code and practices
3. Team review and approval
4. Version bump following semantic versioning
5. Update to all dependent templates and documentation
6. Migration plan for existing violations (if any)

### Versioning

Constitution uses semantic versioning (MAJOR.MINOR.PATCH):

- **MAJOR**: Backward-incompatible changes, principle removals, or redefinitions
- **MINOR**: New principles added or material expansion of existing guidance
- **PATCH**: Clarifications, wording improvements, non-semantic refinements

### Compliance

- All PRs MUST verify compliance with constitution principles
- Feature specifications MUST reference applicable principles
- Implementation plans MUST include Constitution Check section
- Code reviews MUST confirm principle adherence
- Violations MUST be addressed before merge or explicitly justified

### Conflict Resolution

When principles conflict in specific situations:

1. Specification-First and Test-First work together - spec defines what, tests verify what
2. Simplicity wins over premature optimization
3. Observability must not compromise Simplicity - use structured logging, not complex frameworks
4. User-Centric Design is the tiebreaker - choose the approach that best serves users

**Version**: 1.0.0 | **Ratified**: 2025-11-12 | **Last Amended**: 2025-11-12
