#!/bin/sh
set -eu

alertmanager_url="${1:?Alertmanager URL is required}"
receiver_name="${2:?Alertmanager receiver name is required}"
alert_name="${3:?Alert name is required}"
severity="${4:?Alert severity is required}"
smoke_id="${5:?Unique smoke-test id is required}"
max_attempts="${SLACK_DELIVERY_MAX_ATTEMPTS:-15}"
poll_seconds="${SLACK_DELIVERY_POLL_SECONDS:-2}"

case "$max_attempts" in
  '' | *[!0-9]* | 0)
    echo "ERROR: polling attempts and interval must be positive integers" >&2
    exit 1
    ;;
esac
case "$poll_seconds" in
  '' | *[!0-9]* | 0)
    echo "ERROR: polling attempts and interval must be positive integers" >&2
    exit 1
    ;;
esac

metric_value() {
  metric_name="$1"
  curl --fail --silent --show-error "$alertmanager_url/metrics" \
    | awk -v metric="$metric_name" -v receiver="$receiver_name" '
        index($0, metric "{") == 1 &&
        /integration="slack"/ &&
        index($0, "receiver_name=\"" receiver "\"") { total += $2 }
        END { print total + 0 }
      '
}

request_total_before="$(metric_value alertmanager_notification_requests_total)"
request_failed_before="$(metric_value alertmanager_notification_requests_failed_total)"

payload="$(
  jq -nc \
    --arg alert_name "$alert_name" \
    --arg severity "$severity" \
    --arg smoke_id "$smoke_id" \
    '[{
      labels: {
        alertname: $alert_name,
        severity: $severity,
        smoke_id: $smoke_id
      },
      annotations: {
        summary: "Alertmanager Slack delivery smoke test"
      }
    }]'
)"

curl --fail --silent --show-error \
  -H 'Content-Type: application/json' \
  --data "$payload" \
  "$alertmanager_url/api/v2/alerts" >/dev/null

attempt=1
while [ "$attempt" -le "$max_attempts" ]; do
  sleep "$poll_seconds"
  request_total_after="$(metric_value alertmanager_notification_requests_total)"
  request_failed_after="$(metric_value alertmanager_notification_requests_failed_total)"

  if awk \
    -v total_before="$request_total_before" \
    -v total_after="$request_total_after" \
    -v failed_before="$request_failed_before" \
    -v failed_after="$request_failed_after" '
      BEGIN {
        total_delta = total_after - total_before
        failed_delta = failed_after - failed_before
        exit !(total_delta > 0 && failed_delta >= 0 && total_delta > failed_delta)
      }
    '; then
    # The request counters are incremented consecutively. Confirm once more
    # after a delay so a scrape cannot catch the tiny gap between a failed
    # request's total and failed counter increments.
    sleep "$poll_seconds"
    request_total_confirm="$(metric_value alertmanager_notification_requests_total)"
    request_failed_confirm="$(metric_value alertmanager_notification_requests_failed_total)"

    if awk \
      -v total_before="$request_total_before" \
      -v total_after="$request_total_confirm" \
      -v failed_before="$request_failed_before" \
      -v failed_after="$request_failed_confirm" '
        BEGIN {
          total_delta = total_after - total_before
          failed_delta = failed_after - failed_before
          exit !(total_delta > 0 && failed_delta >= 0 && total_delta > failed_delta)
        }
      '; then
      echo "Alertmanager completed a successful Slack request for receiver '$receiver_name'"
      exit 0
    fi
  fi

  attempt=$((attempt + 1))
done

request_total_after="$(metric_value alertmanager_notification_requests_total)"
request_failed_after="$(metric_value alertmanager_notification_requests_failed_total)"
request_total_delta="$(awk -v before="$request_total_before" -v after="$request_total_after" 'BEGIN { print after - before }')"
request_failed_delta="$(awk -v before="$request_failed_before" -v after="$request_failed_after" 'BEGIN { print after - before }')"

echo "ERROR: no successful Slack request completed for receiver '$receiver_name' (requests=$request_total_delta, failed=$request_failed_delta)" >&2
exit 1
