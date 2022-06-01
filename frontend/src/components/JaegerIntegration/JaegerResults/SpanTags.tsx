import * as React from 'react';
import { Button, ButtonVariant, Tooltip } from '@patternfly/react-core';
import { CopyIcon } from '@patternfly/react-icons';
import { KeyValuePair } from '../../../types/JaegerInfo';
import { PFColors } from '../../Pf/PfColors';

interface SpanDetailProps {
  tags: KeyValuePair[];
  label: string;
}

export class SpanTags extends React.Component<SpanDetailProps> {
  constructor(props: SpanDetailProps) {
    super(props);
    this.state = {
      isExpanded: false
    };
  }

  copiedText = (tag: KeyValuePair) => {
    navigator.clipboard.writeText(`{key": "${tag.key}", "type": "string", "value": "${tag.value}"}`);
  };

  printValue = (tag: KeyValuePair) => {
    switch (tag.type) {
      case 'bool':
        if (tag.key === 'error') {
          return <span style={{ color: tag.value ? PFColors.Red200 : PFColors.Blue200 }}>{String(tag.value)}</span>;
        }
        return <span style={{ color: tag.value ? PFColors.Blue200 : PFColors.Red200 }}>{String(tag.value)}</span>;
      case 'string':
        return `"${tag.value}"`;
      default:
        return tag.value;
    }
  };

  render() {
    return (
      <table style={{ width: '100%' }}>
        <tbody>
          {this.props.tags.map((tag, i) => (
            <tr
              key={`tag_${tag}_index_${i}`}
              style={{ backgroundColor: i % 2 === 0 ? PFColors.White : PFColors.Black150 }}
            >
              <td style={{ color: PFColors.Black600, width: '30%' }}>{tag.key}</td>
              <td style={{ color: isNaN(tag.value) ? PFColors.Green500 : PFColors.Blue500 }}>{this.printValue(tag)}</td>
              <td>
                <Tooltip content={<>Copy {`{key": "${tag.key}", "type": "string", "value": "${tag.value}"}`}</>}>
                  <Button variant={ButtonVariant.plain} aria-label="Action" onClick={() => this.copiedText(tag)}>
                    <CopyIcon />
                  </Button>
                </Tooltip>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    );
  }
}
