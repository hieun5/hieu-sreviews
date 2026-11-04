---
version: 1
slug: "src-app-journal-page-tsx"
primary_target: "src/app/(journal)/page.tsx"
related_targets: ["src/app/globals.css","src/components/meal-ticket.tsx","src/app/profiles/page.tsx"]
---

# Meal ticket journal

Mode: Operate. Scope: journal home, reviewer selection, places, recommendation and analytics routes, and review forms.
Primary task: quickly log and rate a meal. Existing data, decimal ratings and reviewer choice remain intact.
Approved reference: .impeccable/mocks/meal-ticket-periwinkle.png. User chose the meal ticket with light blue/light purple accents; the revised image applies that specific instruction.

## Direction contract

THESIS: A small meal ticket makes sharing a review feel quick and personal. Logging leads; saved places and analytics have their own destinations.

OWN-WORLD: Warm ivory, white tickets, charcoal text, pale periwinkle and lilac actions with readable indigo lettering. A bold, friendly serif heading pairs with quiet sans-serif controls; fine rules and two ticket notches carry the character.

STORY: Choose who is reviewing, find or add a place, tap or type a score, optionally leave a note, and save. Existing reviews appear below.

FIRST VIEWPORT: Compact brand navigation, “What did you eat?”, a five-friend reviewer strip, then one open white ticket. Place search precedes the rating and short review. The wide periwinkle save button anchors the form. Mobile navigation stays at the bottom; desktop keeps a centered, readable composition.

FORM: Lunch-counter meal ticket, grounded candidate 4, seed 6b5ceaee. Signature interaction: selecting a score fills its periwinkle cell and updates the plain-language rating feedback; optional details expand inline. Reviewer switching preserves the draft.

FINISH: unreviewed and undocumented is unfinished; this build ends with the finish review, the verdict, DESIGN.md, and every shipping raster carrying its provenance
