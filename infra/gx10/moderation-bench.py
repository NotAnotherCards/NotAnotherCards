#!/usr/bin/env python3
"""Moderation bench: one guard model over a labelled corpus, on ollama.

  python3 moderation-bench.py --model granite4.1-guardian:8b \
      --corpus corpus.jsonl --out results/guardian.jsonl [--per-label 50]

Corpus lines: {"id", "label": "safe"|"unsafe", "text"}. Results carry the id,
never the text. Prints recall, precision, false-positive rate, unparsed count
and p50/p95 latency. Stdlib only; the box has no node.
"""
import argparse, json, re, sys, time, urllib.request, random

PARSERS = {
    # model name prefix -> (regex, flagged values)
    "granite4.1-guardian": (re.compile(r"<score>\s*(yes|no)\s*</score>", re.I), {"yes"}),
    "llama-guard3": (re.compile(r"^\s*(safe|unsafe)", re.I), {"unsafe"}),
    "shieldgemma": (re.compile(r"^\s*(yes|no)\b", re.I), {"yes"}),
    "qwen3guard": (re.compile(r"Safety:\s*(Safe|Unsafe|Controversial)", re.I), {"unsafe", "controversial"}),
}


def parser_for(model):
    for prefix, p in PARSERS.items():
        if model.startswith(prefix):
            return p
    sys.exit(f"no parser for {model}; known: {', '.join(PARSERS)}")


def ask(base, model, text, timeout):
    body = json.dumps({
        "model": model,
        "stream": False,
        "messages": [{"role": "user", "content": text}],
        "options": {"temperature": 0},
    }).encode()
    req = urllib.request.Request(f"{base}/api/chat", data=body,
                                 headers={"Content-Type": "application/json"})
    t = time.monotonic()
    with urllib.request.urlopen(req, timeout=timeout) as r:
        d = json.load(r)
    ms = int((time.monotonic() - t) * 1000)
    return d.get("message", {}).get("content", ""), d.get("eval_count"), ms


def pct(xs, p):
    xs = sorted(xs)
    return xs[min(len(xs) - 1, int(p * len(xs)))] if xs else None


def main():
    a = argparse.ArgumentParser()
    a.add_argument("--model", required=True)
    a.add_argument("--corpus", required=True)
    a.add_argument("--out", required=True)
    a.add_argument("--base", default="http://localhost:11434")
    a.add_argument("--per-label", type=int, default=0, help="subsample N per label, seeded")
    a.add_argument("--timeout", type=int, default=120)
    a.add_argument("--seed", type=int, default=20260910)
    args = a.parse_args()

    rx, flagged_values = parser_for(args.model)
    items = [json.loads(l) for l in open(args.corpus) if l.strip()]
    if args.per_label:
        rnd = random.Random(args.seed)
        by = {}
        for it in items:
            by.setdefault(it["label"], []).append(it)
        items = [it for lab in sorted(by) for it in rnd.sample(by[lab], min(args.per_label, len(by[lab])))]

    # warm the model once so the first timed call is not a weights load
    ask(args.base, args.model, "warm up", args.timeout)

    tp = fp = fn = tn = unparsed = errors = 0
    lat = []
    with open(args.out, "w") as w:
        for i, it in enumerate(items, 1):
            try:
                raw, evals, ms = ask(args.base, args.model, it["text"], args.timeout)
            except Exception as e:  # timeout, connection: fail closed, count it
                errors += 1
                w.write(json.dumps({"id": it["id"], "label": it["label"], "flag": None, "error": str(e)[:120]}) + "\n")
                continue
            m = rx.search(raw)
            flag = (m.group(1).lower() in flagged_values) if m else None
            lat.append(ms)
            if flag is None:
                unparsed += 1
            elif it["label"] == "unsafe":
                tp += flag; fn += (not flag)
            else:
                fp += flag; tn += (not flag)
            w.write(json.dumps({"id": it["id"], "label": it["label"], "flag": flag,
                                "verdict": (m.group(1).lower() if m else raw.strip()[:60]),
                                "ms": ms, "eval": evals}) + "\n")
            if i % 25 == 0:
                print(f"  {args.model}: {i}/{len(items)}", file=sys.stderr)

    n_unsafe = tp + fn
    n_safe = fp + tn
    rec = tp / n_unsafe if n_unsafe else None
    prec = tp / (tp + fp) if (tp + fp) else None
    fpr = fp / n_safe if n_safe else None
    summary = {
        "model": args.model, "items": len(items), "unsafe": n_unsafe, "safe": n_safe,
        "recall": rec, "precision": prec, "fpr": fpr,
        "unparsed": unparsed, "errors": errors,
        "p50_ms": pct(lat, .5), "p95_ms": pct(lat, .95),
    }
    print(json.dumps(summary))


if __name__ == "__main__":
    main()
