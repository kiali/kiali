import * as React from 'react';
import { css } from '@patternfly/react-styles';
import { getHullPath, PointTuple, ShapeProps, useCombineRefs, useSvgAnchor } from '@patternfly/react-topology';

const getDiamondPoints = (width: number, height: number, padding: number): PointTuple[] => [
  [width / 2, -padding],
  [width + padding, height / 2],
  [width / 2, height + padding],
  [-padding, height / 2]
];

export const Diamond: React.FC<ShapeProps> = ({
  className = css('--pf-topology__node__background'),
  width,
  height,
  filter,
  cornerRadius = 0,
  dndDropRef
}) => {
  const anchorRef = useSvgAnchor();
  const refs = useCombineRefs(dndDropRef!, anchorRef);
  const points = React.useMemo(() => {
    const polygonPoints: PointTuple[] = getDiamondPoints(width, height, cornerRadius / 2);

    return cornerRadius
      ? getHullPath(getDiamondPoints(width, height, -cornerRadius), cornerRadius)
      : polygonPoints.map(p => `${p[0]},${p[1]}`).join(' ');
  }, [cornerRadius, height, width]);

  return cornerRadius ? (
    <path className={className} ref={refs as React.LegacyRef<SVGPathElement>} d={points} filter={filter} />
  ) : (
    <polygon className={className} ref={refs as React.LegacyRef<SVGPolygonElement>} points={points} filter={filter} />
  );
};
