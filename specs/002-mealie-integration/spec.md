# Feature Specification: Bidirectional Mealie Integration

**Feature Branch**: `002-mealie-integration`
**Created**: 2026-06-15
**Status**: Draft
**Input**: User description: "Bidirectional Mealie integration for Pantrie, delivered in two phases. Phase 1 (Mealie → Pantrie): external apps authenticate with API client credentials scoped to a household and query/update inventory. Phase 2 (Pantrie → Mealie): Pantrie pulls recipes from a configured Mealie instance and shows which recipes are makeable from current inventory."

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Register an API client for an external app (Priority: P1)

A household admin wants to let an external application (such as Mealie) access their inventory. They create a named API client scoped to their household, choose what it is allowed to do (read, write), and receive a client ID and a secret they can paste into the external app. They can later list their clients and revoke any of them.

**Why this priority**: Without credentials, no external integration can happen at all. This is the foundation every other Mealie→Pantrie scenario depends on, and it delivers value on its own (an admin can issue and manage access).

**Independent Test**: As a household admin, create an API client with read permission, confirm the client ID + secret are returned once, see the client in the list (without the secret), then revoke it and confirm it no longer appears as active.

**Acceptance Scenarios**:

1. **Given** I am an admin of a household, **When** I create an API client named "Mealie" with read permission, **Then** I receive a client ID and a client secret, and the secret is shown only once.
2. **Given** I have created API clients, **When** I list them, **Then** I see each client's name, permissions, status, and last-used time, but never the secret.
3. **Given** an active API client exists, **When** I revoke it, **Then** it can no longer authenticate and it is marked inactive in the list.
4. **Given** I am only an editor or viewer of a household (not admin), **When** I attempt to create or revoke an API client, **Then** the action is refused.

---

### User Story 2 - External app checks ingredient availability (Priority: P1)

An external app (Mealie) authenticates with its client credentials and asks Pantrie whether one or more ingredients are in stock and in what quantity, so it can tell the user which recipes they have ingredients for.

**Why this priority**: This is the headline value of the integration — letting a recipe app reason about what the household actually has. It is the core read capability the spec's API contracts were designed around.

**Independent Test**: Using a valid client ID/secret with read permission, request availability for a list of ingredient names and confirm the response reports, per ingredient, whether it is in stock and the available quantity/unit.

**Acceptance Scenarios**:

1. **Given** a valid client with read permission, **When** it requests an access token using its credentials, **Then** it receives a short-lived token.
2. **Given** a valid access token, **When** the client asks whether "flour" is available, **Then** it receives whether the item is in stock and the quantity and unit on hand.
3. **Given** a valid access token, **When** the client submits a bulk list of ingredients, **Then** it receives an availability result for each one in a single response.
4. **Given** an ingredient that is not in inventory, **When** availability is requested, **Then** the response clearly indicates it is not in stock (rather than an error).
5. **Given** revoked or invalid credentials, **When** the client requests a token or calls an endpoint, **Then** the request is rejected as unauthorized.

---

### User Story 3 - External app updates inventory after cooking (Priority: P2)

After a user cooks a recipe in the external app, the app decrements the quantities of the ingredients it used in Pantrie, so inventory stays accurate without manual edits.

**Why this priority**: High value but builds on US1/US2 and carries more risk (it mutates data), so it follows the read capability. Read-only integrations are still useful without it.

**Independent Test**: Using a client with write permission, decrement the quantity of an in-stock item and confirm the new quantity is persisted; confirm a read-only client is refused.

**Acceptance Scenarios**:

1. **Given** a client with write permission, **When** it decrements an item's quantity by a valid amount, **Then** the item's quantity is reduced and the change is recorded.
2. **Given** a client with only read permission, **When** it attempts to update a quantity, **Then** the request is refused.
3. **Given** a decrement that would take quantity below zero, **When** it is submitted, **Then** the system rejects it or clamps to zero per a defined rule, and reports what happened.
4. **Given** an update to an item in a different household than the client is scoped to, **When** it is attempted, **Then** the request is refused.

---

### User Story 4 - See which Mealie recipes are makeable (Priority: P3)

A Pantrie user who has connected a Mealie instance views recipes pulled from Mealie and sees which ones they can make right now based on current inventory, and what is missing for the rest.

**Why this priority**: This is the Phase 2 (Pantrie → Mealie) direction. It is valuable but depends on a separate outbound connection and recipe data, and is not required for the core integration.

**Independent Test**: With a configured Mealie connection, open the recipes view and confirm recipes load from Mealie and each shows a "can make / missing X items" status derived from inventory.

**Acceptance Scenarios**:

1. **Given** a configured and reachable Mealie instance, **When** the user opens the recipes view, **Then** recipes are listed with their ingredients.
2. **Given** recipes are loaded, **When** the system compares ingredients to inventory, **Then** each recipe shows whether it is makeable and lists any missing ingredients.
3. **Given** the Mealie instance is unreachable or misconfigured, **When** the user opens the recipes view, **Then** a clear, actionable error is shown rather than a blank or broken screen.

---

### User Story 5 - Send missing ingredients to Mealie (Priority: P3)

From a recipe they want to make, a user sends the missing ingredients to a Mealie shopping list, so their shopping workflow stays in Mealie.

**Why this priority**: A convenience that completes the round trip, but lowest priority and dependent on US4.

**Independent Test**: For a recipe with missing ingredients, trigger "add missing to Mealie shopping list" and confirm those items appear in Mealie.

**Acceptance Scenarios**:

1. **Given** a recipe with missing ingredients, **When** the user sends them to Mealie, **Then** those ingredients are added to a Mealie shopping list and the user gets confirmation.
2. **Given** Mealie rejects or partially accepts the request, **When** it returns, **Then** the user is told which items succeeded and which did not.

---

### Edge Cases

- **Ingredient name mismatch**: recipe ingredient text ("2 cups all-purpose flour") rarely equals an inventory item name ("Flour"). The system matches on item name case-insensitively with a fuzzy/substring fallback; ambiguous or no matches are reported as "not matched" rather than silently guessed.
- **Unit mismatch**: a recipe needs "200 g" but inventory is tracked in "kg" or "count". When units are not directly comparable, availability reports the item as present with its tracked quantity/unit and flags that an exact sufficiency check was not possible.
- **Lost client secret**: secrets are shown only once; if lost, the admin must create a new client (no secret retrieval). Revoking the old one is expected.
- **Concurrent updates**: an external decrement and a user edit happen near-simultaneously; the system preserves integrity (no negative quantities, last write resolved deterministically).
- **Soft-deleted items**: availability and updates ignore items that have been removed from inventory.
- **Rate limit exceeded**: a client exceeding its request allowance receives a clear rate-limit response, not a generic error.
- **Mealie API version drift / auth failure**: outbound calls handle unreachable hosts, bad API keys, and unexpected response shapes gracefully.

## Requirements *(mandatory)*

### Functional Requirements

**API client management (US1)**

- **FR-001**: Household admins MUST be able to create an API client scoped to a single household, with a human-readable name.
- **FR-002**: System MUST issue a client identifier and a client secret on creation, and MUST display the secret only once.
- **FR-003**: System MUST store the client secret only in a non-recoverable (hashed) form.
- **FR-004**: Admins MUST be able to assign permission scopes to a client from at least {read, write}, with delete as an optional future scope.
- **FR-005**: Admins MUST be able to list their household's API clients, showing name, permissions, active status, creation time, and last-used time, and MUST NOT be shown the secret again.
- **FR-006**: Admins MUST be able to revoke (deactivate) an API client, after which it cannot authenticate.
- **FR-007**: Only household admins MAY create, list, or revoke API clients; editors and viewers MUST be refused.

**Authentication & authorization for clients (US2/US3)**

- **FR-008**: External clients MUST be able to exchange their client credentials for a short-lived access token.
- **FR-009**: System MUST reject token requests and API calls from revoked, inactive, or invalid clients.
- **FR-010**: Client access MUST be confined to the household the client is scoped to; cross-household access MUST be refused.
- **FR-011**: System MUST enforce per-client permission scopes (e.g., a read client cannot write).
- **FR-012**: Client authentication MUST coexist with, and not interfere with, existing user authentication.
- **FR-013**: System MUST record each client's last-used time.

**Inventory queries (US2)**

- **FR-014**: Authenticated clients with read permission MUST be able to query availability of a single ingredient by name.
- **FR-015**: Authenticated clients with read permission MUST be able to query availability of multiple ingredients in one bulk request.
- **FR-016**: Availability responses MUST report, per ingredient: whether it is in stock, the available quantity and unit, and whether an exact sufficiency comparison was possible.
- **FR-017**: Ingredients not found in inventory MUST be reported as not-in-stock, not as errors.

**Inventory updates (US3)**

- **FR-018**: Authenticated clients with write permission MUST be able to decrement (and adjust) an item's quantity.
- **FR-019**: System MUST prevent quantities from going negative and MUST report the outcome of a clamped or rejected update.
- **FR-020**: System MUST record who/what made each quantity change (attributing it to the API client) for traceability.

**Rate limiting & observability (cross-cutting)**

- **FR-021**: System MUST rate-limit requests per client and return a clear, distinct response when the limit is exceeded.
- **FR-022**: System MUST log client authentication, queries, and updates (with secrets and sensitive data redacted) to support debugging.

**Outbound Mealie connection (US4/US5 — Phase 2)**

- **FR-023**: Users MUST be able to configure a connection to a Mealie instance (base location + credential) for their household.
- **FR-024**: System MUST be able to retrieve recipes (and their ingredients) from the configured Mealie instance.
- **FR-025**: System MUST compute, for each retrieved recipe, whether it is makeable from current inventory and which ingredients are missing.
- **FR-026**: Users MUST be able to send a recipe's missing ingredients to a Mealie shopping list, and MUST be told which items succeeded or failed.
- **FR-027**: System MUST handle an unreachable or misconfigured Mealie instance with a clear, actionable error.

### Key Entities *(include if feature involves data)*

- **API Client**: An external application's credentials and access policy. Belongs to exactly one household. Attributes: name, public identifier, non-recoverable secret, permission scopes, active status, creation time, last-used time.
- **Client Access Token**: A short-lived credential a client uses after exchanging its secret. Conceptually tied to a client and its household and scopes; not necessarily persisted.
- **Mealie Connection**: Per-household configuration for reaching a Mealie instance (location + credential). (Phase 2.)
- **Recipe (from Mealie)**: A recipe and its ingredient list retrieved from Mealie; not stored as a first-class Pantrie record beyond what is needed to compute makeability. (Phase 2.)
- **Ingredient Availability Result**: A computed, transient result per ingredient: matched item (if any), in-stock flag, available quantity/unit, and whether sufficiency could be exactly determined.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: A household admin can create an API client and obtain working credentials in under 2 minutes without reading documentation.
- **SC-002**: An external app can go from credentials to a successful ingredient-availability response in a single documented sequence of no more than two requests (token, then query).
- **SC-003**: A bulk availability check for 25 ingredients returns a complete result in a single response, quickly enough to feel instant to an end user (under ~1 second under normal load).
- **SC-004**: 100% of cross-household or revoked-client access attempts are refused.
- **SC-005**: After an external decrement, the updated quantity is reflected in the Pantrie UI within the same timeframe as any other inventory change (under ~5 seconds).
- **SC-006**: Inventory quantities never become negative as a result of external updates.
- **SC-007**: Clients exceeding their request allowance receive a distinct rate-limit response (not a generic failure) 100% of the time.
- **SC-008 (Phase 2)**: For a connected Mealie instance, at least 80% of recipes whose ingredient names reasonably correspond to inventory items are correctly classified as makeable or not.
- **SC-009 (Phase 2)**: A misconfigured or unreachable Mealie connection always results in an actionable error message, never a blank or broken view.

## Assumptions

- **Phasing**: Phase 1 (US1–US3, Mealie→Pantrie) is the MVP and will be built and shipped before Phase 2 (US4–US5, Pantrie→Mealie). Each phase is independently valuable and testable.
- **Ingredient matching**: Matching recipe ingredient text to inventory items is name-based, case-insensitive, with a fuzzy/substring fallback (reusing the existing inventory name search behavior). Quantity parsing from free-text recipe lines is best-effort.
- **Unit handling**: Cross-unit sufficiency (e.g., grams vs. kilograms vs. count) is not fully converted in the MVP; when units are not directly comparable the result flags that sufficiency could not be exactly determined. Full unit conversion is out of scope for the MVP.
- **Permission scopes**: The MVP supports read and write scopes; delete is reserved for later.
- **Token lifetime & rate limit**: Access tokens are short-lived and the per-client rate limit follows the project's existing API guidance (on the order of 1000 requests/hour) unless changed during planning.
- **Mealie connection scope**: A Mealie connection is configured per household. Credentials for the outbound connection are stored securely and never returned in plaintext.
- **Secret recovery**: Client secrets are non-recoverable; loss requires creating a new client.

## Dependencies

- Existing household, membership/role, and inventory capabilities (admins, items with quantity/unit/name, soft-delete).
- Existing user authentication, which the new client authentication must operate alongside without conflict.
- For Phase 2, a reachable external Mealie instance and valid credentials supplied by the user.

## Out of Scope

- Full unit-of-measure conversion and normalization across recipe and inventory units.
- Two-way recipe authoring or editing recipes in Mealie from Pantrie.
- Real-time push from Pantrie to external clients (clients poll/query; server-sent events are not part of this feature).
- Importing Mealie's full recipe catalog into Pantrie as persistent records.
- OAuth provider/identity federation beyond the client-credentials flow for machine-to-machine access.
