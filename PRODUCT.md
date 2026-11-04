# Product

<!-- impeccable:product-schema 1 -->

## Platform

web

## Users

A small group of friends sharing restaurant and café reviews. The selectable profiles are Hieu, Ky-An, Vinh, Nick, and Mai-Han.

## Product Purpose

Make it easy and fun to remember meals together. The primary task is quickly logging and rating a meal.

## Capabilities and Constraints

Preserve the choice of who is leaving a review. Keep existing places, review history, individual scores, group scores, and profile switching. The existing application also supports group recommendations and analytics; these remain available without competing with logging a meal.

Unfinished reviews are intentionally discarded when someone leaves or refreshes the form. Do not autosave or restore them. Existing drafts from earlier versions are cleared. Entered values may remain while switching reviewers on the same form or retrying a failed save, but only a successful submission persists a review.

Feeds offer “Review this place too” once per saved place, only when the selected friend has never reviewed it. Eligibility uses the full journal even when a feed is filtered or shortened. Place pages keep one main action: “Add your review” for a first visit, or “Review another visit” afterward; existing reviews retain Edit. The new-review form keeps all five reviewer choices visible and preserves entered values during profile switching. It never copies another friend’s score or text.

Written-review summaries are removed from the interface at the user's request because generation is not fully implemented. Do not display a summary panel, locked summary controls, or summary setup prompts until this feature is ready and requested again.

The application uses Next.js, React, Tailwind CSS, and PostgreSQL. Existing data and API behavior must be preserved. The local checkout is connected to the existing Neon production journal through private, ignored environment configuration. Use an isolated Neon branch for write verification; preserve the shared journal and unfinished browser drafts.

Pick a place uses saved places only. Choose who's coming to get up to ten suggestions; missing personal ratings use that place's current group ratings as fallback evidence. Fallback values are never saved as a friend's own rating. Each pick shows only its rank, linked place name, and match score. Keep past picks, selection/dismissal controls, explanations, optional preference filters, and discovery mode out of this flow. Food stats belongs beside Pick a place in bottom navigation. More insights contains rating history and friend comparison, without spending totals or recommendation activity.

Changing attendees clears the previous group's picks until a new search completes. Journal search and Everyone/Your reviews are independent refinements: switching scope preserves the search, and clearing search preserves scope. Keep the search field free of placeholder copy, with its accessible label and search icon.

## Brand Commitments

The existing product name is hieu’s reviews. The requested personality is simple, fun, friendly, and easy to use. The user requested image mockups before implementation, then selected the meal-ticket direction with light blue and light purple accents.

This is an everyday app for the existing friend group. Keep copy short and direct. Avoid promotional taglines, introductory pep talks, and generic account disclaimers in the interface. The user explicitly removed the profile-page intro/disclosure and the home-page tagline. Fast, reliable meal logging remains the next functional priority.

## Evidence on Hand

Existing routes, forms, profile definitions, ratings, and backend contracts in src/. The connected journal contains the group's existing places and reviews. No restaurant photographs are supplied locally. Mockup meal and restaurant content must be identified as illustrative.

## Product Principles

- Put logging and rating a meal within easy reach.
- Make the active reviewer obvious and easy to change.
- Keep optional detail out of the quickest path.
- Use familiar language and preserve the group’s existing information.
