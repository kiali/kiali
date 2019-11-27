#!/usr/bin/env bash

FLOW_LOC_NUM=$(ag -l @flow src | tr '\n' ' ' | xargs wc -l | tail -1 | awk '{print $1}')
JS_LOC_NUM=$(find src -name '*.js' \! -name '*.test.js' -print | tr '\n' ' ' | xargs wc -l | tail -1 | awk '{print $1}')
TSC_LOC_NUM=$(find src -name '*tsx' -print | tr '\n' ' ' | xargs wc -l | tail -1 | awk '{print $1}')
PCT_JS_DONE_NUM=$(awk "BEGIN { print ${TSC_LOC_NUM} / (${JS_LOC_NUM} + ${TSC_LOC_NUM}) * 100 }")
PCT_FLOW_DONE_NUM=$(awk "BEGIN { print ${TSC_LOC_NUM} / (${FLOW_LOC_NUM} + ${TSC_LOC_NUM}) * 100 }")

FLOW_LOC=$(printf "%'d" $FLOW_LOC_NUM)
JS_LOC=$(printf "%'d" $JS_LOC_NUM)
TSC_LOC=$(printf "%'d" $TSC_LOC_NUM)
PCT_JS_DONE=$(printf '%.2f %%' $PCT_JS_DONE_NUM)
PCT_FLOW_DONE=$(printf '%.2f %%' $PCT_FLOW_DONE_NUM)

echo "LOC"
echo ""
echo "TypeScript    $TSC_LOC"
echo "Flow          $FLOW_LOC"
echo ""
echo "JavaScript    $JS_LOC"
echo "Complete      $PCT_JS_DONE"
