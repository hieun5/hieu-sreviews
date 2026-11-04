disposition: fix

No catalog QUALITY BAR card applies to the grounded candidate; the assigned card in decision.json and approved revised comp supply the reference. Populated database screens and live persistence remain unverified because no database is configured. No browser was used.

## persistence

Fail on strict build persistence. PRODUCT.md and the approved-comp record exist. Comps, spec, and plates are closed without forced records. FORM's candidate 4 / seed 6b5ceaee agrees with direction-notes.md and state.json. The hero phase remains open, its recorded score is 0.636, and sections/motion/responsive/review remain pending. hero-repro.png exists. The unsuccessful geometric gate must remain disclosed; functional tests do not close it. DESIGN.md does not yet exist, which is expected before the documenter runs.

All seven required captures exist and are valid: desktop 1440×1431, mobile full page 390×1261, mobile viewport 390×844, user 507×1241, profiles 507×896, picks 507×748, hero 1024×1536. Fixed navigation in full-page captures is a capture artifact at the original viewport bottom, not evidence that later content is unreachable.

## fidelity

The comp's salient inventory is an ivory ground, friendly dark serif question, compact wordmark with smiling food mark, five pastel reviewer circles with selected check, an open white ticket with side notches and ink rules, place search, ten numbered rating cells, feedback, optional short note and details, a wide periwinkle save action, friends' review row, and three-item bottom navigation.

Both diff reports record 0.636. Their paired crops frequently compare a comp field with a different actual row: place-search contains the actual rating heading; rating-buttons contains the actual review heading; save-review contains the actual unavailable-state panel. Those findings measure incompatible viewport geometry, not absent controls. The actual mobile captures establish the responsive inventory. Adaptations below cite the surface's responsive first-viewport contract, product truth, or preserved capabilities.

| Element / measured region | Judgment | Evidence |
| --- | --- | --- |
| TYPE | match | Self-hosted Libre Caslon Text bold retains the comp's heavy, high-contrast serif character; DM Sans supplies friendly controls. Actual sizes suit logical viewports. |
| MATERIAL | match | White ticket, flat pastel controls, circles, rules and notches retain the semantic, largely flat material. Spec owes zero raster plates. |
| GROUND | match | Sampled comp #faf8f5 versus actual #faf9f5 at x2/y180: effectively the same ivory temperature, no material warm/cool drift. |
| brand-icon (contradicted) | adaptation | Existing yellow FoodDoodle mark is preserved; HEAD Brand already used it. Product continuity supports retaining the existing brand. |
| brand-name (contradicted) | adaptation | Same name and bold sans character, scaled for a compact real header under the responsive contract. Paired crop is spatially misregistered. |
| header-links | adaptation | Our places persists; explicit active-profile control replaces ambiguous overflow. Desktop navigation moves into the header as contracted. |
| lead (contradicted) | adaptation | Same dominant serif question, responsive 32px mobile / 48px wide display; raster lettering cannot be copied literally at CSS scale. |
| intro | match | Same sentence and subordinate role. |
| reviewer-label (missing) | match | Clearly visible above the reviewer strip. |
| reviewer-choices (missing) | adaptation | Five named friends, pastel circles and selected check remain. Multi-letter initials improve identification; mobile sizes preserve a usable strip. |
| ticket-top (missing) | match | Rounded white ticket begins at the place field in all actual captures. |
| place-label (missing) | match | The place remains the first ticket label. |
| place-search (missing) | match | Search and add capability are present; boundary contrast needs the fix below. |
| ticket-notch-rule | contradicted | Notches remain, but #c7c9d0 rule loses the comp's inked separation and weakens the ticket signature. |
| rating-label (missing) | match | Your rating remains directly after place. |
| rating-buttons (missing) | adaptation | Ten numbered cells and periwinkle selection persist; responsive touch geometry and retained decimal entry explain the extra numeric field. |
| rating-feedback (missing) | match | Score and plain-language reaction remain immediately below the row. |
| review-divider (missing) | contradicted | Divider exists but its very faint ink repeats the signature-rule contrast loss. |
| review-label (missing) | match | A little review remains; optional is explicitly labeled. |
| review-input (missing) | match | Short note field remains before the optional-details disclosure. |
| optional-details (missing) | adaptation | Inline native disclosure retains the promised behavior and accessible semantics. |
| save-review (missing) | match | Wide periwinkle button, bold label and right arrow remain. It is reachable by scrolling on mobile. |
| ticket-bottom (missing) | match | White ticket closes below its primary action. |
| friends-heading (missing) | match | Around the table follows the ticket. |
| friends-link (missing) | match | See all remains aligned with that heading. |
| friend-review (missing) | adaptation | Honest unavailable state replaces illustrative content because local product records are unavailable. PRODUCT.md forbids treating mockup meals as production truth. |
| illustrative-label (missing) | adaptation | No illustrative record ships, so its label is correctly absent. |
| bottom-nav (missing) | adaptation | All three semantic destinations and library icons persist on mobile; desktop header navigation is explicitly contracted. |

THESIS, OWN-WORLD and STORY are retained. FIRST VIEWPORT preserves reviewer → place → rating → note order; save needs a modest scroll at 390×844, an acceptable consequence of readable inputs rather than a reason to shrink touch targets. FORM keeps selected-cell feedback and inline details. The parent reports browser verification of draft-preserving reviewer changes; source supports that behavior. The first viewport is memorable as a small shared meal ticket with five friends, rather than a generic dashboard.

## ceiling

The grounded card's restraint is maintained: one task, quiet controls, strong save accent, no competing dashboard. The comp's inked ticket separation is underused. Additional illustration, ornament, photographic material or entrance choreography is unnecessary for this simple operating surface. The score-selection transition supplies the relevant interaction emphasis. No prohibited kickers, gradient text, hard block shadows, glyph-icon substitutes or decorative card grids were observed. Populated place/details/stats presentation has source review only, not visual verification.

## material_fixes

1. Persistence check: retain and disclose the open 63.6% geometric reproduction gate, and record the responsive visual review separately; complete remaining phase evidence truthfully without converting the failed numeric result into a pass.
2. Fidelity / accessibility: strengthen input and decimal-rating boundaries to at least 3:1 against white (current .input #b7bac6 ≈1.94:1; exact-rating border #dfdfe5 ≈1.33:1). Carry restrained darker ink into both ticket rules, restoring the approved ticket's visible separation. A color such as #9296a3 is a suitable starting point; keep the pale blue/purple fills.

## keep

Keep the simple reviewer → place → rating flow, draft-preserving reviewer switch, decimal scores, honest unavailable states, friendly serif voice, restrained periwinkle action and mobile bottom navigation.

## verdict

1. Persistence — partial. The original 0.636 hero result remains open and unforced, with an explicit note separating responsive review from numeric reproduction. The reproduced seed record now corroborates candidate 4. Remaining functional phase evidence was still pending and verification.md was absent when this verdict was written. This is a workflow finding, not a remaining interface correction.
2. Input boundaries and ticket rules — resolved. Refreshed desktop, 390px, 507px and hero captures visibly show stronger place/note/decimal/quick-rating outlines and two clear ticket separators, while preserving pale fills and the original hierarchy. The supplied computed boundary color #8d919f reaches 3.14:1 against white; decorative rules #9699a5 need not meet the input-boundary threshold. The picks select also carries the stronger boundary.

No regressions from this correction batch were observed. All required captures remain valid, including the unchanged profiles capture. This is a scoped verdict on the two earlier findings, not a new audit.

## remaining

Interface correction: clear. Workflow: remaining phase evidence is pending, and exact geometric reproduction remains unproven at 0.636. Do not present that numeric gate as passed. No further interface patch is requested by this verdict.

disposition: fix
