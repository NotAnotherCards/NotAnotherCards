#!/bin/sh
set -eu

template_path="${1:?Prometheus template path is required}"
output_path="${2:?Prometheus output path is required}"
gx10_mode="${GX10_METRICS_MODE:-proxy}"
gx10_host="${GX10_METRICS_HOST:-ai.dustyway.org}"

case "$gx10_host" in
  '' | *[!A-Za-z0-9.-]*)
    echo "ERROR: GX10_METRICS_HOST must be a hostname or IPv4 address without a scheme, path, or port" >&2
    exit 1
    ;;
esac

case "$gx10_mode" in
  proxy)
    litellm_scheme=https
    litellm_target="$gx10_host"
    litellm_path=/metrics
    dcgm_scheme=https
    dcgm_target="$gx10_host"
    dcgm_path=/dcgm/metrics
    node_scheme=https
    node_target="$gx10_host"
    node_path=/node/metrics
    ;;
  tailnet)
    litellm_scheme=http
    litellm_target="$gx10_host:4000"
    litellm_path=/metrics
    dcgm_scheme=http
    dcgm_target="$gx10_host:9400"
    dcgm_path=/metrics
    node_scheme=http
    node_target="$gx10_host:9100"
    node_path=/metrics
    ;;
  *)
    echo "ERROR: GX10_METRICS_MODE must be 'proxy' or 'tailnet'" >&2
    exit 1
    ;;
esac

sed \
  -e "s|__GX10_LITELLM_SCHEME__|$litellm_scheme|g" \
  -e "s|__GX10_LITELLM_TARGET__|$litellm_target|g" \
  -e "s|__GX10_LITELLM_PATH__|$litellm_path|g" \
  -e "s|__GX10_DCGM_SCHEME__|$dcgm_scheme|g" \
  -e "s|__GX10_DCGM_TARGET__|$dcgm_target|g" \
  -e "s|__GX10_DCGM_PATH__|$dcgm_path|g" \
  -e "s|__GX10_NODE_SCHEME__|$node_scheme|g" \
  -e "s|__GX10_NODE_TARGET__|$node_target|g" \
  -e "s|__GX10_NODE_PATH__|$node_path|g" \
  "$template_path" > "$output_path"
