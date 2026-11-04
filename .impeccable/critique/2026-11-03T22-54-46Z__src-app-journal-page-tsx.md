---
target: meal logging, journal and place details after button cleanup
total_score: 28
max_score: 40
na_heuristics:
p0_count: 0
p1_count: 1
target_identity: "file:/Users/hieunguyen/projects/hieu-sreviews/src/app/(journal)/page.tsx"
target_fingerprint: "sha256:d30143f29d189f346a51e4b78f6520022eecbbc71604136a3446737643edd879"
target_path: /Users/hieunguyen/projects/hieu-sreviews/src/app/(journal)/page.tsx
timestamp: 2026-11-03T22-54-46Z
slug: src-app-journal-page-tsx
---
Method: dual-agent (A: critique2_design · B: critique2_evidence), followed by synthesis and a targeted draft-safety source check.

28/40 — Good. The visual direction works; reliability and page hierarchy need the next pass.

| Heuristic | /4 | Finding |
|---|---:|---|
| System status | 3 | Clear reviewer and loading feedback |
| Familiar language | 4 | Names and meal language fit the group |
| User control | 2 | Starting a blank review can replace an unfinished draft |
| Consistency | 3 | Logging is focused; place details are more cluttered |
| Error prevention | 2 | Draft replacement and misleading current-score labels remain |
| Recognition | 3 | Switching journal scope loses the search |
| Efficiency | 2 | Save and visit history require excess scrolling |
| Minimalism | 3 | Repeated score panels and locked summaries add weight |
| Error recovery | 3 | Source retains failed submissions; live failures untested |
| Contextual help | 3 | Short hints and optional details suit this app |
| Total | 28/40 | Good |

Design specificity: authored for this product. Named avatars, meal-ticket shape, warm paper and blue/purple accents form a coherent identity. Preserve it. Larger mobile rating targets and cleaner review-button rules are strengths, together with visible reviewer identity and optional-detail disclosure. Place detail uses more generic stacked panels and lacks the form's task discipline.

Priority issues:

1. [P1] An unfinished draft can still be overwritten accidentally. The blank form remains editable beneath recovery. Editing marks it dirty, hides recovery, and writes into the same storage key. Source-confirmed; not reproduced against a real draft. Require explicit Continue or Start another review before replacing saved work. Sources: src/components/meal-ticket.tsx:81 and :340, src/components/use-meal-draft.ts:35-47. Suggested command: impeccable harden.
2. [P2] Search can label an older review Current score. IDs derive from displayed visits rather than allVisits. If an old written review matches and a later visit doesn't, the older result gets the label. Derive current IDs from complete history. Source-confirmed conditional issue; present data lacks repeat visits. Source: src/components/visit-list.tsx:28. Suggested command: impeccable harden.
3. [P2] Switching Everyone / Your reviews clears search. Observed /journal?q=chicken -> /journal?view=personal with empty search. Preserve q in scope links and scope when clearing query. Source: src/app/(journal)/journal/page.tsx:42-46. Suggested command: impeccable harden.
4. [P2] Score-only mobile completion requires scrolling past optional note content. At 390×844, Save is below initial viewport and after optional textarea/disclosure. Make completion reachable after required place/rating while retaining optional detail. Not a task blocker. Source: src/components/meal-ticket.tsx:571 onward and :766. Suggested command: impeccable adapt.
5. [P2] Place detail prioritizes repeated summaries above original visits. Two score cards, five latest-score rows and locked summary precede history, even with three visits. Compact overview; move ineligible summary below visits or into a disclosure. Sources: src/app/(journal)/places/[id]/page.tsx:88, :113, :169, :191 and src/components/review-summary-panel.tsx:94. Suggested command: impeccable distill.

Cognitive load: ordinary logging is low; place detail is moderate because several representations of the same small set precede originals. Search-scope query loss creates a memory demand. Five named reviewers and ten ordinal scores are appropriate bounded choices, not overload.

Emotional journey: warm arrival and clear ownership; score feedback promises a small reward. Mobile completion introduces extra scrolling; detail loses momentum in repeated summaries and locked generation. Draft replacement and filter semantics are trust risks. Save/error/restore states were source reviewed, not live exercised.

Personas: distracted mobile friend must scroll past optional content to finish; friend recalling a meal must traverse summary panels before notes; friend filtering earlier opinions loses query and may see an old matching review marked current.

Minor observations: live copy says 1 visits from Nick. Mobile Journal Search wraps its button to a separate row. The static detector reported 0 primary issues and 4 advisory design-system-font-size occurrences, value 11px: src/app/(journal)/places/[id]/page.tsx:139 and :192, src/components/visit-list.tsx:75, src/components/review-summary-panel.tsx:147. These are accurate scale inconsistencies, not demonstrated major UI faults; generated citations were reviewed statically because current place has no written reviews.

Evidence: A and B independent, A complete before detector release. CLI scanned ten TSX files: home, journal, place detail, meal ticket, rating picker, reviewer picker, visit list, visit form, review summary panel and navigation. Exit 0, no other findings or false positives. Desktop 1280×720 and phone 390×844 inspected at /, /journal, and /places/9934e1a4-dd61-4bea-a3dd-b264b0a22dbe. Current journal has one place and three score-only visits. No actual review, profile or draft mutations. Read-only evaluate disallows injection; native screenshot/AX/DOM evidence used, no overlay or visualization live-server claimed. No live save/error/generation tests.

Questions to consider: prioritize reliability fixes (draft and search) or shorter phone/detail layouts? Address reliability only first or all five issues?
