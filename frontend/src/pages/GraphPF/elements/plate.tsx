import * as React from 'react';
import { css } from '@patternfly/react-styles';
import { getHullPath, PointTuple, ShapeProps, useCombineRefs, useSvgAnchor } from '@patternfly/react-topology';

const getPlatePoints = (width: number, height: number, padding: number): PointTuple[] => [
  [padding, padding],
  [width - width / 4 - padding, padding],
  [width - padding, height / 2],
  [width - width / 4 - padding, height - padding],
  [padding, height - padding]
];

export const Plate: React.FC<ShapeProps> = ({
  className = css('--pf-topology__node__background'),
  width,
  height,
  filter,
  cornerRadius = 5,
  dndDropRef
}) => {
  const anchorRef = useSvgAnchor();
  const refs = useCombineRefs(dndDropRef!, anchorRef);
  const points = React.useMemo(() => {
    return getHullPath(getPlatePoints(width, height, cornerRadius), cornerRadius);
  }, [cornerRadius, height, width]);

  return <path className={className} ref={refs as React.LegacyRef<SVGPathElement>} d={points} filter={filter} />;
};
