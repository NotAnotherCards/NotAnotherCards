# AI generation

How a user's input becomes cards. Two paths share one backend; the
difference is who waits.

## The shared pieces

Every generation goes through `AiGatewayService` in `apps/api/src/ai`. It
holds one request builder for the LiteLLM gateway (`AI_API_BASE`) and one
card parser that strips `<think>` blocks, extracts the JSON array, requires
string front and back, truncates long fields and clamps the count.
`AiLimitsService` checks quotas before a run starts: daily requests and
daily tokens over a rolling 24 h window, plus a cap on queued jobs. Each
run writes one row to `ai_usage`. `AI_MOCK=1` answers without a GPU.

## Queued jobs

Deck generation and word notes create a row in `ai_generation_jobs`. A
worker picks it up, calls the gateway, retries with backoff and writes the
result into the row. Clients poll the row. The job survives the tab
closing, which is why this path exists.

## Prompts

Prompts live in `apps/api/src/ai/prompts`, one versioned file per job type
(`topic-generation.v1`, `text-generation.v1`, `word-note.v1`). Every
request sets `reasoning_effort: 'none'`: with thinking on, a five-card job
ran 26 to 56 seconds against the 60 second timeout, without it about three
seconds. The model is asked for JSON only; the parser tolerates prose and
`<think>` around it anyway.

## Filling a word note

The note form of a word deck takes one word in either language. The api
snapshots the deck's language pair when it enqueues the job, so a retry
builds the same prompt even if the deck changed since. The prompt names
which JSON field holds which language for the chosen direction, for
example: "translation" is the English word, given; put its Spanish
translation in "word". The user's input overwrites whatever the model
echoed back, and a gender the target language does not have is dropped.
The result is stored on the job as a candidate, not written to the deck:
the user reviews the filled fields and saves, and saving creates the note
and its sibling cards through the same templates as a hand-typed note.

## The streamed playground

`POST /api/ai/playground/stream` serves the playground. The api asks the
gateway for a streamed response with `stream: true`, reads the SSE chunks
as they arrive and forwards the text to the browser as its own events:
`data: {"delta"}` per piece, then `{"result", cards}` or `{"error"}`. The
browser shows the deltas live and only accepts a validated result, so
nobody can save partial output.

Each run follows a fixed order. Reserve one usage row under the per-user
lock; that reservation is the quota check. Stream, then parse. Write a job
row born `completed` or `failed`, so the run shows in history and the
worker never sees it. Finalize the usage row with the tokens from the
stream's final chunk, or zero if it never arrived. These two writes share
one transaction: a failed usage update cannot leave a completed history job.
Only after commit may the response report success.

The response sets `X-Accel-Buffering: no` so nginx does not buffer the
stream. A browser disconnect aborts the gateway request.
`AI_REQUEST_TIMEOUT_MS` starts before quota reservation and is checked before
generation and before reporting success. Database operations are not cancelled:
reservation or accounting can delay the timeout response beyond the deadline.
Known usage is still recorded, but the browser never receives a late success.
If the deadline expires during finalization, the completed, accounted result
may still be available in history even though the stream reports a timeout.

## Errors

A queued job that fails retries with backoff (20/40/80 s, three attempts),
then the worker marks it `failed` and stores the error on the row. Gateway
errors and unparsable output both take that path. A streamed run fails
when the stream stalls past the timeout, ends without `[DONE]`, or the
cards do not parse; the browser gets an `error` event, never partial
cards. A failed run still counts a request, at zero tokens if the usage
chunk never arrived, so only the request cap stops a failing loop.

## Moderation at publish

Only the publish endpoint calls it, on every card of the deck's snapshot,
through the separate `moderation` gateway alias (qwen3guard-8b); it does not
go through `AiGatewayService`. The classifier grades each card `Safe`,
`Unsafe` or `Controversial`: an unsafe card refuses publication with the
card and its category in the 422 body; a controversial card is returned as a
warning on the successful response. An unreachable gateway, a timeout or an
unparsable verdict refuses publication with `moderation unavailable`; there
is no allow-on-error path. A deck check has a 60 s budget and fails closed when
that budget runs out. Private decks are never checked.
`MODERATION_ALLOW_ALL=1` bypasses the classifier, for tests and demos only.
