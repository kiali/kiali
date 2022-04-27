BASE_DATE=${BASE_DATE:-$(date -d '2021-12-03' '+%s')} # Use last day of Sprint #66 as the base date for calcs
NOW_DATE=${NOW_DATE:-$(date -d 'now' '+%s')}

# Transitional calculations
DATE_DIFF=$(( $NOW_DATE - $BASE_DATE ))
DAYS_ELAPSED=$(( $DATE_DIFF / (24*60*60) ))
WEEKS_ELAPSED=$(( $DAYS_ELAPSED / 7))

# This value will be used to determine the type of the release
WEEKS_MOD3=$(( $WEEKS_ELAPSED % 3 ))

# Between Dec 23th 2021 and Jan 14th 2022, use Mod6 (six-week sprint)
if [ $NOW_DATE -ge $(date -d '2021-12-23' '+%s') ] && [ $NOW_DATE -lt $(date -d '2022-01-14' '+%s') ];
then
  WEEKS_MOD3=$(( $WEEKS_ELAPSED % 6 ))
fi

case $WEEKS_MOD3 in
  0)
    RELEASE_TYPE='minor' ;;
  1)
    RELEASE_TYPE='snapshot.0' ;;
  2)
    RELEASE_TYPE='snapshot.1' ;;
  3)
    RELEASE_TYPE='snapshot.2' ;;
  4)
    RELEASE_TYPE='snapshot.3' ;;
  5)
    RELEASE_TYPE='snapshot.4' ;;
esac

# Print the determined type
echo $RELEASE_TYPE