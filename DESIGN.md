---
name: hieu’s reviews
description: A friendly meal ticket for food reviews with friends.
colors:
  paper: "#faf9f5"
  ink: "#282b32"
  muted: "#676773"
  accent: "#565c9c"
  line: "#dfdfe5"
  surface: "#fff"
  accent-soft: "#cbd0fa"
  accent-hover: "#bbc3f5"
  accent-ink: "#303658"
  blue-soft: "#deedfc"
  lilac-soft: "#eee7fa"
  field-line: "#8d919f"
  ticket-rule: "#9699a5"
  field-hover: "#797f90"
  field-error: "#a13c50"
  badge-bg: "#f0eef8"
  badge-ink: "#565478"
  notice-bg: "#eef6f3"
  notice-ink: "#335d50"
  notice-line: "#cddbd8"
  error-bg: "#fff1f3"
  error-ink: "#873a4b"
  error-line: "#eac5cd"
  friend-periwinkle: "#e1e5fc"
  friend-periwinkle-ink: "#424779"
  friend-sage: "#e1edd9"
  friend-sage-ink: "#40543b"
  friend-lilac: "#ece2fa"
  friend-lilac-ink: "#644e80"
  friend-blue: "#ddecfa"
  friend-blue-ink: "#3c5875"
  friend-rose: "#f6deea"
  friend-rose-ink: "#75475e"
typography:
  display:
    fontFamily: Libre Caslon Text, Georgia, serif
    fontSize: 44px
    fontWeight: 700
    lineHeight: 1.16
    letterSpacing: "-0.035em"
  headline:
    fontFamily: Libre Caslon Text, Georgia, serif
    fontSize: 34px
    fontWeight: 700
    lineHeight: 1.2
    letterSpacing: "-0.035em"
  title:
    fontFamily: DM Sans, sans-serif
    fontSize: 20px
    fontWeight: 700
    lineHeight: 1.2
    letterSpacing: "-0.025em"
  body:
    fontFamily: DM Sans, sans-serif
    fontSize: 15px
    fontWeight: 400
    lineHeight: 1.6
  label:
    fontFamily: DM Sans, sans-serif
    fontSize: 13px
    fontWeight: 700
  control:
    fontFamily: DM Sans, sans-serif
    fontSize: 14px
    fontWeight: 700
  ticket-label:
    fontFamily: DM Sans, sans-serif
    fontSize: 18px
    fontWeight: 700
    lineHeight: 1.3
    letterSpacing: "-0.02em"
rounded:
  badge: 6px
  compact: 7px
  tab: 8px
  nav: 9px
  control: 10px
  panel: 14px
  ticket: 16px
  avatar: 50%
spacing:
  "4": 4px
  "8": 8px
  "12": 12px
  "16": 16px
  "18": 18px
  "20": 20px
  "24": 24px
  "28": 28px
  "32": 32px
components:
  button-primary:
    backgroundColor: "{colors.accent-soft}"
    textColor: "{colors.accent-ink}"
    typography: "{typography.control}"
    rounded: "{rounded.control}"
    padding: 11px 20px
  button-primary-hover:
    backgroundColor: "{colors.accent-hover}"
  button-secondary:
    backgroundColor: "{colors.surface}"
    textColor: "{colors.ink}"
    typography: "{typography.control}"
    rounded: "{rounded.control}"
    padding: 11px 20px
  button-quiet:
    backgroundColor: transparent
    textColor: "{colors.accent}"
    typography: "{typography.control}"
    rounded: "{rounded.control}"
    padding: 11px 20px
  button-danger:
    backgroundColor: "#fff5f6"
    textColor: "#9a3c4c"
    typography: "{typography.control}"
    rounded: "{rounded.control}"
    padding: 11px 20px
  input:
    backgroundColor: "{colors.surface}"
    textColor: "{colors.ink}"
    rounded: "{rounded.control}"
    padding: 11px 13px
    width: 100%
  nav:
    textColor: "{colors.muted}"
    rounded: "{rounded.nav}"
    padding: 10px 12px
  badge:
    backgroundColor: "{colors.badge-bg}"
    textColor: "{colors.badge-ink}"
    rounded: "{rounded.badge}"
    padding: 4px 8px
  panel:
    backgroundColor: "{colors.surface}"
    rounded: "{rounded.panel}"
  meal-ticket:
    backgroundColor: "{colors.surface}"
    rounded: "{rounded.ticket}"
    padding: 26px 28px 28px
  rating-option:
    backgroundColor: "{colors.surface}"
    textColor: "{colors.ink}"
    rounded: "{rounded.nav}"
    padding: "0"
  rating-option-selected:
    backgroundColor: "{colors.accent-soft}"
    textColor: "{colors.accent-ink}"

---

# Design System: hieu’s reviews

## Overview

**Creative North Star: "The Meal Ticket"**

A small lunch-counter meal ticket makes a review feel personal and easy to finish. Warm ivory surrounds white paper; pale periwinkle, light blue and lilac give the controls a friendly character. Charcoal type and visible rules keep the soft palette readable.

Bold Libre Caslon Text supplies the inviting voice, while DM Sans keeps names, labels and scores easy to scan. Circles identify friends; a pair of side notches gives the meal form its signature. The visual language stays quiet enough for honest opinions to lead.

**Key Characteristics:**

- Warm paper and white tickets with restrained, cool pastel accents.
- Expressive serif headings paired with clear sans-serif controls.
- Named friend avatars, visible selected states and short, conversational labels.
- Mostly flat surfaces; subtle shadow reserved for the ticket and search results.

This document captures the implemented reusable system. Page strategy remains in [the surface brief](.impeccable/surfaces/src-app-journal-page-tsx.md). Extraction sources are `src/app/globals.css`, `src/app/layout.tsx`, shared components and implemented pages. Reviewed captures and verification evidence live in `.impeccable/review/`; source owns the final boundary contrast correction.

Verification limits: the strict 1024×1536 reference-reproduction gate remains open at 63.6%; this is not a passed pixel match. No configured DATABASE_URL was available, so populated database screens and live persistence remain unverified. These limits do not change the tokens recorded here.

## Colors

Warm paper and charcoal anchor soft periwinkle, blue and lilac. Frontmatter owns exact values; source custom-property names are retained where available.

### Primary

- **Periwinkle Action** (`accent-soft`, `accent-hover`): primary buttons and selected rating cells, paired with **Indigo Lettering** (`accent-ink`).
- **Quiet Indigo** (`accent`): links, navigation emphasis, selected-reviewer ring, caret and focus outline.

### Secondary

- **Blue Wash** (`blue-soft`): restaurant icon tiles.
- **Lilac Wash** (`lilac-soft`): café icon tiles and quiet/score hover states.
- **Friend Pastels**: periwinkle, sage, lilac, blue and rose have paired dark lettering tokens. They distinguish Hieu, Ky-An, Vinh, Nick and Mai-Han in that order. Names remain visible; color is not the sole identifier. Legacy avatar keys retain their stable profile mapping.

### Neutral

- **Warm Paper** (`paper`): page ground and ticket cutouts; **White Ticket** (`surface`): editable fields and panels.
- **Charcoal** (`ink`): primary copy; **Quiet Gray** (`muted`): helper copy and metadata.
- **Soft Line** (`line`): panel/table dividers. **Field Ink** (`field-line`) and **Field Hover** (`field-hover`): editable boundaries. **Ticket Rule** (`ticket-rule`): visible ticket separation.
- **Badge Violet** (`badge-bg`, `badge-ink`): cuisine and price metadata.
- **Sage Notice** (`notice-*`): saved/status feedback. **Rose Notice** (`error-*`) and `field-error`: error feedback. Meaning also appears in text and semantics.

**The Readable Pastel Rule.** Put dark indigo lettering on pale blue and purple fills. Keep input boundaries and ticket rules visibly separate from white.

The corrected field boundary has approximately 3.14:1 contrast on white. This boundary result is not a claim that every application state passed accessibility review. Brand-doodle colors belong to its existing SVG artwork rather than the control palette.

## Typography

**Display Font:** Libre Caslon Text, with Georgia and serif fallbacks. **Body and Control Font:** DM Sans, with sans-serif fallback. Both are self-hosted with `next/font/local` and swap loading. DM Sans ships regular (400) and bold (700); Libre Caslon Text ships bold (700). License files live beside the fonts in `src/app/fonts/`.

The serif is welcoming and substantial; the sans-serif is compact and practical. The hierarchy follows implemented roles rather than a mathematical scale.

- **Display:** the meal-form prompt uses the frontmatter display role; it grows to (48px) at wide screens, becomes (32px/1.2) on mobile and (30px) at the narrowest breakpoint.
- **Headline:** secondary page titles use the headline role, reducing to (29px) on mobile. Profile welcome uses (42px), then (34px) on mobile.
- **Title:** section headings use the title role, reducing to (19px) on mobile.
- **Body:** the body role is the desktop default; mobile body becomes (14px). Intro copy uses (17px), then (14px). Helper text generally uses (12–13px).
- **Label and Control:** small field labels use the label role; buttons use the control role. Ticket labels have a dedicated role, reducing to (17px) on mobile. Native editable fields use (16px) on mobile.
- **Scores:** prominent scores use bold (28px), tight tracking and tabular numerals. Exact-rating entry and quick-score cells remain sans-serif.

**The Two Voices Rule.** Use Libre Caslon Text for major headings and DM Sans for controls, names, scores and body copy.

Some existing Tailwind headings request semibold; the shipped self-hosted sans weights are 400 and 700. Do not describe an additional bundled semibold file as present.

## Layout

The application uses a centered shell, readable task columns and flexible rows. Header width is capped at (1200px), general page content at (1120px), and the reusable meal-form column at (704px). Desktop page gutters are (32px), with (44px) top and (64px) bottom padding. Wide-screen top padding becomes (52px). The observed spacing vocabulary mixes small control gaps with (16–32px) section spacing; frontmatter records reused steps rather than a compulsory uniform grid.

- **At and below 1000px:** navigation becomes fixed at the bottom with three equal icon-and-label destinations. Content reserves (110px) plus the bottom safe-area inset. Place grids reduce from three columns to two.
- **At and below 600px:** content uses (20px) horizontal gutters, (22px) top padding and (106px) plus safe-area bottom space. Ticket padding becomes (18px). Quick scores use two rows of five with (8px) gaps and minimum (48px) height; decimal entry is (76px) wide and minimum (48px) tall. Place cards become one column. Profile choices become two columns with the fifth spanning both; the inline five-friend strip stays one row with smaller (42px) avatars. Profile-switch text is hidden while its accessible avatar remains.
- **At and below 360px:** gutters reduce to (14px) and paired detail fields stack. The secondary places header link is hidden.
- **At and above 1440px:** established spacing and prompt size expand; the task column stays capped.

Form detail pairs use two equal columns with (16px) gaps, then (12px) on mobile. Search rows and header actions wrap. Tables have a local horizontal scroll wrapper. The profile page is capped at (1000px); recommendation controls at (760px). Long names and errors wrap without widening the page.

## Elevation & Depth

This is a mostly flat paper system. White surfaces, restrained borders and warm surrounding space provide hierarchy. The meal ticket has a small ambient lift; place-search results use a stronger shadow to separate their overlay. No large page glow or entrance motion is implemented.

### Shadow Vocabulary

- **Ticket lift:** `0 4px 16px #30354e0b, 0 2px 4px #30354e08`.
- **Search overlay:** `0 8px 24px #30354e18`.
- **Selected score:** `inset 0 -2px 0 #a0abe4`.
- **Mobile active-nav marker:** `0 0 0 5px #e6e7fb`, a local icon highlight rather than surface elevation.

**The Paper Rule.** Use white, fine borders and breathing room to group content. Keep the meal ticket’s soft lift and notches distinctive.

Routine hover transitions use (0.18s), with CSS default easing, for the affected background, color, border or shadow. Loading placeholders breathe over (1.4s), ease-in-out, alternating indefinitely. Reduced-motion preference disables transitions and animations. Motion and breakpoints live in the sidecar because frontmatter does not support them.

## Shapes

Round geometry is gentle and practical: badge corners are small, fields/buttons use the control radius, panels are softer, and the signature ticket uses the largest card radius. Avatar and selection-check shapes are circular. Frontmatter records exact radii.

Fine (1px) borders group ordinary surfaces. Editable boundaries use darker Field Ink; a selected reviewer uses a (2px) indigo ring plus check. The ticket’s two (20px) paper-colored circles intersect its sides at the first rule, creating its signature silhouette. Icons are thin inline SVGs; the existing smiling food doodle carries brand warmth.

## Components

### Buttons

Friendly, legible and softly rounded. Primary buttons use Periwinkle Action and Indigo Lettering, (11px 20px) padding and minimum (46px) height. The ticket save action spans its container with minimum (50px) height. Hover uses the accent-hover token; pressed uses `#aeb8f0`.

Secondary buttons are white with a soft border, dark text and `#f0eff9` hover. Quiet buttons are transparent with indigo text and lilac hover. Danger buttons use restrained rose text, border and fill, deepening on hover. Variants inherit the base pressed rule. Disabled buttons use (0.6) opacity and a waiting cursor; pending actions use explicit text such as “Saving your review…”.

Keyboard-focusable controls inherit a (3px) indigo outline with a (4px) offset. Preserve it alongside local focus treatments.

### Chips

Metadata badges are compact violet labels with (4px 8px) padding, (11px/1.4) type and badge-radius corners. They wrap long content and do not imply selection. Attendee selectors are separate checkbox labels with minimum (44px) height; checked state changes border and fill while retaining the visible checkbox. Filter tabs use muted defaults, pale selected fill, indigo text and a bold selected label.

### Cards / Containers

Panels are white with a soft-line border and panel radius. Content determines padding: place cards use (22px), analytics panels (24px), and mobile analytics panels (18px). Place hover changes border and near-white fill. Empty/unavailable states retain a small doodle or line icon, clear heading, short explanation and optional secondary action; they never fabricate meals.

### Inputs / Fields

Fields are white with charcoal text, darker boundary, control radius and (11px 13px) padding; minimum height is (46px). Search fields are (50px) tall with room for inset search icon and selected check. Hover darkens the border; focus changes it to indigo and preserves the global focus-visible outline. Placeholder text is `#747480`. Invalid generic fields use `#a73e53` borders and textual errors beneath. The exact-rating field does not have the generic invalid-border selector; its error is exposed through text and aria semantics.

Textareas resize vertically. Success notices use sage; errors use rose with status/alert semantics. The ticket focuses its error summary and retains the draft after a failed save. Optional fields expand inline with native details/summary and open when a hidden field needs correction.

### Navigation

Desktop links form a horizontal icon-and-label row with minimum (44px) height, muted defaults, pale hover and indigo current-page treatment. Mobile uses a fixed bottom bar with minimum (54px) link height and safe-area padding. Current-page text stays bold; a pale marker sits behind its icon. Accessible labels and aria-current stay in the implementation. A skip link appears on keyboard focus.

### Meal Ticket, Reviewer and Rating

The ticket combines white paper, ticket radius, ambient lift, visible rules and side notches. Its field grammar is a strong label, simple control, short feedback and inline optional detail.

Five named pastel avatars identify reviewers. Active selection adds bold text, an indigo ring and a small blue checked circle; hover lightly tints its button. Desktop avatar size is (56px), mobile (42px). Reviewer changes preserve the form draft; switching/pending disables competing actions. Full profile cards use larger (68px) avatars, hover wash and a (2px) selected border.

Quick ratings use ten equal buttons, white default fill, field boundary and minimum (44px) height; mobile uses two rows of five with minimum (48px) height. The selected integer cell gains periwinkle fill, indigo text and shallow inset mark. Separate exact entry permits decimals and does not falsely select an integer cell. Polite live feedback states score and reaction below.

The sidecar has ten self-contained styling previews of implemented primitives, using neutral placeholder content. It previews states rather than application submission or persistence.

## Do's and Don'ts

### Do:

- Do use the existing light blue and light purple palette with dark, readable text.
- Do preserve explicit selected, focus, pending and error states.
- Do identify friends with names as well as pastel initials.
- Do let the layout scroll naturally and reserve space for fixed mobile navigation.
- Do keep unavailable and empty states honest; illustrative meals are not production reviews.

### Don’t:

- Don’t replace the meal-ticket identity with a dense dashboard or decorative card grid.
- Don’t use pale decorative dividers as the boundary of an editable field.
- Don’t replace decimal entry with integer-only score shortcuts.
- Don’t add entrance choreography or large shadows to routine controls.
