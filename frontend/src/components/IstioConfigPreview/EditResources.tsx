import * as React from 'react';
import { IstioConfigItem } from './IstioConfigPreview';
import { Tab, Tabs } from '@patternfly/react-core';
import { EditorPreview, PolicyItem } from './EditorPreview';
import { yamlDumpOptions } from '../../types/IstioConfigDetails';
import { isEqual } from 'lodash-es';
import { dump } from 'js-yaml';

interface Props {
  isIstioNew?: boolean;
  items: IstioConfigItem[];
  onChange: (obj: PolicyItem, index: number) => void;
  orig: IstioConfigItem[];
}

export const EditResources: React.FC<Props> = (props: Props) => {
  const [resourceTab, setResourceTab] = React.useState<number>(0);

  return (
    <Tabs activeKey={resourceTab} onSelect={(_, tab) => setResourceTab(Number(tab))}>
      {props.items
        .sort((a, b) =>
          props.isIstioNew
            ? a.metadata.namespace!.localeCompare(b.metadata.namespace!)
            : a.metadata.name.localeCompare(b.metadata.name)
        )
        .map((item, i) => {
          return (
            <Tab
              eventKey={i}
              key={i}
              title={
                <>
                  {props.isIstioNew ? item.metadata.namespace : item.metadata.name}{' '}
                  {!isEqual(
                    item,
                    props.orig.filter(it =>
                      props.isIstioNew
                        ? it.metadata.namespace === item.metadata.namespace
                        : it.metadata.name === item.metadata.name
                    )[0]
                  ) && '*'}
                </>
              }
            >
              <EditorPreview yaml={dump(item, yamlDumpOptions)} onChange={obj => props.onChange(obj, i)} />
            </Tab>
          );
        })}
    </Tabs>
  );
};
