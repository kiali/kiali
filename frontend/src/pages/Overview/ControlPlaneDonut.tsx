import { ChartDonut, ChartLabel, ChartLegend } from '@patternfly/react-charts';
import * as React from 'react';
import { ControlPlane } from 'types/Mesh';
import { kialiStyle } from 'styles/StyleUtils';

type Props = {
  controlPlanes: ControlPlane[];
};

export const infoStyle = kialiStyle({
  margin: '0 0 -0.125rem 0.25rem'
});

export const ControlPlaneDonut: React.FC<Props> = ({ controlPlanes }) => {
  const total = controlPlanes.reduce((acc, cp) => acc + (cp.managedNamespaces?.length || 0), 0);
  const [hoveredSlice, setHoveredSlice] = React.useState<number | undefined>(undefined);
  // Sorting so that the positions of the donut slices don't change on re-render.
  // We can't sort the legendData because that includes the ':' char in the name
  // which messes up the sort order.
  controlPlanes.sort((a, b) => a.istiodName.localeCompare(b.istiodName));
  const legendData = controlPlanes.map(cp => ({
    name: `${cp.istiodName}:`,
    subtext: ` ${cp.managedNamespaces ? cp.managedNamespaces.length : 0}`
  }));

  // Using a custom label here because there's no way to bold part of the text otherwise.
  // This let's us break the text into two parts and apply separate styles to each so
  // we can bold the first part and leave the second normal.
  // e.g. <strong>1-21-1:</strong> 4
  const label = (
    <ChartLabel
      inline={true}
      style={[{ fontWeight: 'bold' }, { fontWeight: 'inherit' }]}
      text={({ datum }) => [datum.name, datum.subtext] as any}
    />
  );

  // Using a custom legendComponent so that we can pass custom data through to
  // the custom labelComponent. Otherwise the label component will only get
  // the name as the datum.
  const legend = <ChartLegend labelComponent={label} data={legendData} />;

  // This shows the number of namespaces inside the donut.
  // It will update based on what slice you are hovering over.
  const title =
    hoveredSlice !== undefined && controlPlanes.at(hoveredSlice)
      ? controlPlanes[hoveredSlice].managedNamespaces?.length || 0
      : total;
  const height = 180;
  const width = 300;
  return (
    <div data-test="controlplane-donut">
      <div>Namespaces managed by Control Planes</div>
      <div style={{ height: `${height}px`, width: `${width}px` }}>
        <ChartDonut
          constrainToVisibleArea
          style={{
            data: {
              // This will highlight the hovered slice on the donut
              // by making the rest of the slices
              // that aren't hovered more opaque.
              opacity: ({ index }) => (hoveredSlice !== undefined && hoveredSlice !== index ? 0.3 : 1.0)
            }
          }}
          height={height}
          width={width}
          // Padding is used to "center" the chart svg underneath the title
          padding={{
            top: 20,
            left: 100,
            bottom: 20,
            right: 0
          }}
          data={controlPlanes}
          events={[
            {
              target: 'data',
              eventHandlers: {
                onMouseEnter: (_, props) => {
                  setHoveredSlice(props.index);
                },
                onMouseLeave: () => {
                  setHoveredSlice(undefined);
                }
              }
            }
          ]}
          labels={({ datum }) =>
            `${datum.istiodName}: ${(((datum.managedNamespaces?.length || 0) / total) * 100).toFixed(2)}%`
          }
          legendData={legendData}
          legendComponent={legend}
          legendOrientation="vertical"
          title={`${title}`}
          subTitle="namespaces"
          sortOrder="ascending"
          x="istiodName"
          y={datum => datum.managedNamespaces?.length || 0}
        />
      </div>
    </div>
  );
};
