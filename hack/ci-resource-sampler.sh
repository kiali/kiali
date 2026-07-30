#!/bin/bash
# ci-resource-sampler.sh — lightweight background host telemetry for CI jobs.
#
# Collects /proc/pressure PSI counters, memory, disk, and top processes every
# N seconds into a CSV. Designed to run under nice/ionice with fully redirected
# output so it never interferes with the actual job.
#
# Usage:
#   hack/ci-resource-sampler.sh start --csv /tmp/telemetry.csv [--interval 10]
#   hack/ci-resource-sampler.sh stop  --csv /tmp/telemetry.csv
#
# start: writes CSV header + meta rows, launches background sampler, stores PID.
# stop:  kills the background process, prints a one-line summary to stdout.

set -u

CSV=""
INTERVAL=10
CMD="${1:-}"
shift || true

while [[ $# -gt 0 ]]; do
  case "$1" in
    --csv)      CSV="${2:-}";      shift 2 || { echo "missing --csv value"; exit 2; } ;;
    --interval) INTERVAL="${2:-}"; shift 2 || { echo "missing --interval value"; exit 2; } ;;
    *) echo "unknown arg: $1"; exit 2 ;;
  esac
done

psi_total() {
  local f="/proc/pressure/$1"
  [ -r "$f" ] || { echo -1; return; }
  awk '/^some/ {for(i=1;i<=NF;i++) if ($i ~ /^total=/) {sub("total=","",$i); print $i; exit}}' "$f"
}

cpu_ticks() {
  awk '/^cpu /{tot=0; for(i=2;i<=NF;i++) tot+=$i; steal=(NF>=9)?$9:0; print steal" "tot; exit}' /proc/stat
}

one_row() {
  local ts psi_c psi_m psi_i steal tot mem dw dd tp
  ts=$(date -u +%Y-%m-%dT%H:%M:%SZ)
  psi_c=$(psi_total cpu)
  psi_m=$(psi_total memory)
  psi_i=$(psi_total io)
  read -r steal tot <<<"$(cpu_ticks)"
  mem=$(awk '/^MemAvailable:/{print $2; exit}' /proc/meminfo)
  mem=${mem:--1}
  dw=$(df -m --output=avail "${GITHUB_WORKSPACE:-.}" 2>/dev/null | tail -1 | tr -d ' ')
  dd=$(df -m --output=avail /var/lib/docker 2>/dev/null | tail -1 | tr -d ' ')
  tp=$(ps -eo pcpu,pmem,comm --sort=-pcpu 2>/dev/null | head -6 | tail -5 | awk '{printf "%s:%.1f%%cpu:%.1f%%mem;",$3,$1,$2}')
  echo "${ts},${psi_c},${psi_m},${psi_i},${steal},${tot},${mem},${dw:--1},${dd:--1},\"${tp}\""
}

summarize() {
  [ -r "$CSV" ] || { echo "no CSV at $CSV"; return; }
  local rows peak_mem min_dw min_dd
  rows=$(grep -c '^20' "$CSV" 2>/dev/null || echo 0)
  peak_mem=$(awk -F, '/^20/{if($7+0>0 && ($7<m || m=="")) m=$7} END{print (m==""?"-1":m)}' "$CSV")
  min_dw=$(awk -F, '/^20/{v=$8+0; if(v>0 && (v<m || m=="")) m=v} END{print (m==""?"-1":m)}' "$CSV")
  min_dd=$(awk -F, '/^20/{gsub(/"/, "", $9); v=$9+0; if(v>0 && (v<m || m=="")) m=v} END{print (m==""?"-1":m)}' "$CSV")
  echo "samples=${rows} min_mem_avail_kb=${peak_mem} min_free_workspace_mb=${min_dw} min_free_docker_mb=${min_dd}"
}

case "$CMD" in
  start)
    [ -n "$CSV" ] || { echo "missing --csv"; exit 2; }
    echo "ts,psi_cpu_us,psi_mem_us,psi_io_us,cpu_steal_ticks,cpu_total_ticks,mem_avail_kb,disk_free_workspace_mb,disk_free_docker_mb,top_procs" > "$CSV"
    mt=$(awk '/^MemTotal:/{print $2; exit}' /proc/meminfo)
    echo "# mem_total_kb=${mt:-unknown} interval_s=${INTERVAL} psi=$([ -r /proc/pressure/cpu ] && echo available || echo absent)" >> "$CSV"
    ( while true; do one_row >> "$CSV"; sleep "$INTERVAL"; done ) &
    echo $! > "${CSV}.pid"
    echo "sampler started (pid=$!, csv=$CSV, interval=${INTERVAL}s)"
    ;;
  stop)
    [ -n "$CSV" ] || { echo "missing --csv"; exit 2; }
    if [ -f "${CSV}.pid" ]; then
      kill "$(cat "${CSV}.pid")" 2>/dev/null || true
      rm -f "${CSV}.pid"
    fi
    summarize
    ;;
  *)
    echo "usage: $0 start|stop --csv <path> [--interval N]"
    exit 2
    ;;
esac
