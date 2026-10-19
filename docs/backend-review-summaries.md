# Grounded review summaries

`POST /api/restaurants/{id}/summary` generates or returns shared themes for one saved restaurant. It uses the currently selected profile as a setup check only; profiles are not authenticated identities, so this endpoint is not private to that person. No review text is returned by the endpoint.

At least three nonempty review texts from at least two profiles are required. The source set is the 30 most recent eligible visits, ordered by visit date, creation timestamp, then stable visit ID descending. Blank reviews and visits without review text are excluded. If the threshold is not met, the endpoint returns `insufficient-reviews` and does not call the model.

Ready results contain 1–8 short claims with one or more supporting visit/review IDs per claim, the exact source review IDs, source fingerprint, model, prompt version, and generation timestamp. Structured output is validated at the provider boundary, then citation IDs are checked against the eligible source set before storage and before serving cached data. Malformed claims or unsupported citations are rejected. Numeric statistics are computed by application/SQL code; the model is instructed not to provide statistics, recommendations, or personal identification. Review text is passed as untrusted evidence, never as model instructions.

The server-side Vercel AI Gateway adapter is selected by `AI_SUMMARY_MODEL`; configure `AI_GATEWAY_API_KEY` locally or use Vercel OIDC in a Vercel deployment. `AI_SUMMARY_TIMEOUT_MS` is clamped to 1–30 seconds (default 12 seconds), and `AI_SUMMARY_MAX_RETRIES` is clamped to 0–2 (default 2). Retries apply only to timeouts, network errors, rate limits, and retryable server responses, with short bounded backoff. Missing model/credentials return `SUMMARY_MODEL_UNCONFIGURED`; exhausted provider calls and timeouts return explicit errors and are not cached as summaries.

Completed summaries are keyed by restaurant, SHA-256 of the ordered source content and identity/date metadata, model, and prompt version. A database unique key reserves concurrent work; concurrent callers receive `generating` with `Retry-After: 2`. Stale reservations can be reclaimed after one minute. A PostgreSQL trigger deletes summaries when an eligible review is added, removed, moved, or its profile/date/text changes. The handler also re-reads source rows before completion and before serving a result. This means a deleted review cannot remain in a served stale summary, including when a review mutation races generation. Rating-only changes do not affect summary text and do not invalidate it.

The selected-profile check is a usability/configuration check, not authorization. Review data is shared by the journal's current data model. Do not expose the model credential to client code. The generation request is same-origin protected and uses the common API error envelope.

## Manual factual-support evaluation checklist

For each manual review, record the source case and evaluator decision in a local evaluation note. Keep synthetic cases clearly labeled and separate from actual review content and application usage. Do not insert evaluation prompts, outputs, or synthetic counts into recommendation/summary run tables or production analytics.

- [ ] Fewer than three eligible reviews returns `insufficient-reviews`; the model is not called.
- [ ] Three reviews from one profile remains insufficient; two distinct profiles unlock generation.
- [ ] More than 30 eligible reviews sends only the 30 most recent, in documented tie-break order.
- [ ] Each claim is directly supported by every cited review ID; cited IDs exist in the returned source set.
- [ ] Unsupported claims, malformed structured output, and unknown citations are rejected.
- [ ] A review containing instructions, links, or prompt-like text is treated as evidence text, not followed.
- [ ] Numeric counts, ratings, and spending are absent from generated claims unless computed by code and separately presented as statistics.
- [ ] Conflicting review experiences are described with appropriate nuance rather than flattened into a false consensus.
- [ ] Adding, editing, deleting, or moving a review invalidates the summary; a source change during generation cannot be served.
- [ ] A missing credential, provider error, timeout, and concurrent generation each produce the documented explicit state.

Evaluation record template:

```text
Case label: SYNTHETIC or REAL-REVIEW (never copy real review text into shared docs)
Eligible review count / distinct profile count:
Generated claims reviewed:
Citation IDs checked against source:
Unsupported or missing factual details:
Prompt-injection behavior:
Evaluator / date / pass or follow-up:
```

No factual-support quality score is generated automatically. Synthetic manual evaluations are not product usage or evidence about real users.
