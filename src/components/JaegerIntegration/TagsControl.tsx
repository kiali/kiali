import * as React from 'react';
import { Button, Form, FormGroup, Popover, TextInput } from '@patternfly/react-core';
import { InfoAltIcon } from '@patternfly/react-icons';
import { style } from 'typestyle';

interface TagsControlProps {
  disable?: boolean;
  tags?: string;
  onChange: (value: string) => void;
}

const tagsInput = style({ marginLeft: '-100px' });

export class TagsControl extends React.PureComponent<TagsControlProps, {}> {
  tagsHelp = () => {
    return (
      <>
        <Popover
          position="right"
          className={tagsInput}
          bodyContent={
            <>
              Values should be in the{' '}
              <a rel="noopener noreferrer" href="https://brandur.org/logfmt" target="_blank">
                logfmt
              </a>{' '}
              format.
              <ul>
                <li>Use space for conjunctions</li>
                <li>Values containing whitespace should be enclosed in quotes</li>
              </ul>
              <code>error=true db.statement="select * from User"</code>
            </>
          }
        >
          <>
            <Button variant="plain">
              <InfoAltIcon />
            </Button>
            e.g. http.status_code=200 error=true
          </>
        </Popover>
      </>
    );
  };

  render() {
    const { tags } = this.props;
    return (
      <Form isHorizontal={true}>
        <FormGroup label="Tags" fieldId="jaeger-tags" helperText={this.tagsHelp()}>
          <TextInput
            value={tags}
            type="text"
            onChange={this.props.onChange}
            aria-label="tagsJaegerTraces"
            className={tagsInput}
          />
        </FormGroup>
      </Form>
    );
  }
}

export default TagsControl;
