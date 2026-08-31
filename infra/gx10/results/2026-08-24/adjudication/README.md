# Adjudication method

Review scope: every card that Opus marked `error` or `uncertain`, plus every
Qwen-flagged card that Opus marked `ok`. This produced 204 cards. Claude Fable
5 reviewed them in blinded batches through the local Claude Code subscription.
Each item included the original campaign prompt, target card, and other cards
from the same generation run. Fable did not receive model identities or prior
judge verdicts.

Each card receives one disposition:

- `major_error`: factually wrong, teaches a false rule, answers a different
  question, or is malformed enough that the card cannot be used as written.
- `minor_error`: the core answer is useful and correct, but wording,
  qualification, or scope should be fixed before use.
- `duplicate_only`: correct and usable in isolation, but duplicates another
  card from the same generated set.
- `judge_false_positive`: acceptable under the original prompt and deck
  context; no correction is needed.
- `unresolved`: requires a specialist or external source to decide.

The final report counts major and minor errors separately. Duplicate-only
cards measure deck diversity, not factual accuracy. Judge false positives do
not count against the generating model.

Fable classified 72 cards as major errors, 92 as minor errors, and 40 as judge
false positives. It returned no duplicate-only or unresolved verdicts. These
are model-judge results, not human fact-checks.
