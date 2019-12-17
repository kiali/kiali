#!/bin/bash

# This script determines the type of release that
# should be done, given the current date.
# It is possible to specify a different date
# by setting the NOW_DATE environment variable.
# The script will print a text:
# - "minor": if it's determined that a minor release
#     should be built.
# - "snapshot.0": if it's determined that a snapshot
#     release should be built (specifically, the first
#     snapshot of the sprint.
# - "snapshot.1": if it's determined that a snapshot
#     release should be built (specifically, the second
#     snapshot of the sprint.
# - "snapshot.2": for some sprints with longer duration.
#
# The reference date (base date) can be set in the
# environment variable BASE_DATE. By default, it is the
# last day of Kiali Sprint #14. Starting at end of Sprint #33,
# BASE_DATE is the last day of Sprint #33.
#
# Both NOW_DATE and BASE_DATE should be given in seconds
# since EPOCH. It is assumed that this script is run weekly
# starting in the base date. Running at different timespans
# won't guarantee a good result.

BASE_DATE=${BASE_DATE:-$(date -d '2018-11-30' '+%s')}
NOW_DATE=${NOW_DATE:-$(date -d 'now' '+%s')}

# At end of Sprint #33, we use it's last day as the base date
cond=$(date -d '2020-01-10' '+%s')
if [ $NOW_DATE -ge $cond ];
then
  BASE_DATE=$cond
fi

# Transitional calculations
DATE_DIFF=$(( $NOW_DATE - $BASE_DATE ))
DAYS_ELAPSED=$(( $DATE_DIFF / (24*60*60) ))
WEEKS_ELAPSED=$(( $DAYS_ELAPSED / 7))

# This value will be used to determine the type of the release
WEEKS_MOD3=$(( $WEEKS_ELAPSED % 3 ))

# Sprint #33 is 4 weeks long. Return 'snapshot.2' between Jan 3rd and Jan 9th
if [ $NOW_DATE -ge $(date -d '2020-01-03' '+%s') ] && [ $NOW_DATE -lt $(date -d '2020-01-10' '+%s') ];
then
  echo 'snapshot.2'
  exit 0
fi

case $WEEKS_MOD3 in
  0)
    RELEASE_TYPE='minor' ;;
  1)
    RELEASE_TYPE='snapshot.0' ;;
  2)
    RELEASE_TYPE='snapshot.1' ;;
esac

# Print the determined type
echo $RELEASE_TYPE
