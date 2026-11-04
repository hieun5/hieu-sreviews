---
target: simplified meal logging and supporting friend flows
total_score: 29
max_score: 40
na_heuristics:
p0_count: 0
p1_count: 1
target_identity: "file:/Users/hieunguyen/projects/hieu-sreviews/src/app/(journal)/page.tsx"
target_fingerprint: "sha256:1e7e6935755ef76c1b24b5906732b4022ed0649dc7541931bbea45e702e6248b"
target_path: /Users/hieunguyen/projects/hieu-sreviews/src/app/(journal)/page.tsx
timestamp: 2026-11-04T00-05-53Z
slug: src-app-journal-page-tsx
closed: true
---
Method: dual-agent (A: critique3_design · B: critique3_evidence).

29/40 — Good. The app is cleaner and coherent; next improvements should protect unfinished work and make changing groups predictable.

| Heuristic | /4 | Finding |
|---|---:|---|
| System status | 3 | Clear save states; picks outlive chosen group |
| Familiar language | 4 | Natural meal sequence |
| User control | 2 | Fresh edits can replace recoverable draft |
| Consistency | 3 | Optional errors lack primary-field linkage |
| Error prevention | 2 | Draft replacement needs explicit decision |
| Recognition | 3 | Changed attendees require comparison with old caption |
| Efficiency | 3 | Quick scores, decimals, optional details |
| Minimalism | 4 | Recent removals focus primary tasks |
| Error recovery | 3 | Failed saves retain values; associations need work |
| Contextual help | 2 | Exceptional draft/storage states need feedback |
| Total | 29/40 | Good |

Design specificity: authored for this friend group. Notched meal ticket, warm paper, Caslon prompt, named pastel friends, pale blue/purple controls form a coherent personal vocabulary. Keep explicit reviewer strip, generous phone targets, optional detail disclosure and distinct supporting destinations. No redesign or restoration of deliberately removed promotional copy, placeholders, score hints, filters, badges or recommendation explanations is recommended.

Priority issues:

1. [P1] Fresh edits can overwrite an unfinished draft. Source-confirmed: meal-ticket.tsx:84 marks dirty, :351 hides recovery when dirty, and use-meal-draft.ts:35–55 writes new content into the same key after 350ms or navigation. Not reproduced against real drafts. Preserve old draft until explicit continue/replace decision; alternatively support multiple drafts. Suggested command: impeccable harden.
2. [P2] Attendee changes leave old picks visible. recommendation-panel.tsx:36–43 changes attendees without invalidating run; :129–142 displays previous results and original caption. Caption is accurate, but comparing it with changed checkboxes creates unnecessary memory burden. Hide results or mark refresh needed when attendee sets differ. Keep pick content limited to rank, linked name, match. Suggested command: impeccable harden.
3. [P2] Optional validation lacks field/error associations. meal-ticket.tsx:641–710 exposes aria-invalid for order/date/spending but no aria-describedby or error IDs; address/cuisine at :765–800 lack consistent invalid state and linkage. Give stable error IDs and connect them to controls; retain automatic optional-details expansion. Suggested commands: impeccable audit, then harden.

Cognitive load: low overall. Five friends and ten ordinal scores are appropriate familiar sets, not an option-overload defect. Grouping, hierarchy and progressive disclosure work. Stale attendee results create a memory-comparison burden.

Emotional journey: warm arrival, familiar friend selection and simple scoring create a positive moment. Recovery reassures after interruption, making silent replacement especially damaging. Success/error end states are source reviewed, not exercised against production.

Personas: interrupted mobile friend risks losing earlier meal; screen-reader user may not hear an invalid optional field's precise explanation; friend changing dinner attendees can read stale group picks.

Minor observations: blocked/full local storage fails silently (src/lib/client/meal-draft.ts:82–92); analytics metadata can say 1 reviewers · 1 visits; some metadata is very small. Detector exit0, zero primary findings, seven design-system-font-size advisories: src/app/(journal)/places/[id]/page.tsx:138 and :170 (11px), src/components/visit-list.tsx:71 (11px), src/components/dashboard-analytics.tsx:69 and :101 (11px), :137 and :184 (10px). Five 11px findings overlap documented metadata vocabulary, so not established major usability faults; two10px analytics evidence captions merit readability polish.

Evidence: independent agents; A never saw detector output. B sent an early count-only status to parent, while detailed findings stayed withheld until A complete. CLI scanned journal route directory plus meal-ticket, rating-picker, reviewer-picker, visit-list, visit-form, recommendation-panel, dashboard-analytics and navigation. A inspected home at1280×720 and390×844 and supporting Journal/Places/Picks/Stats; B inspected home/recommendations/analytics desktop1280×720. No edits, actual review/profile/draft mutations or recommendation generation. Browser evaluate read-only; no overlay or visualization live-server. Native AX/screenshots and static evidence substituted. Own tabs closed and viewport reset; user's existing server left running.

Questions to consider: keep multiple unfinished meals or explicitly confirm replacement? Hide old picks on attendee change or leave visibly marked until another search?
