import * as React from 'react';
import {
  Button,
  ButtonVariant,
  Modal,
  Tabs,
  Tab,
  Toolbar,
  ToolbarGroup,
  ToolbarItem,
  Tooltip
} from '@patternfly/react-core';
import { AuthorizationPolicy, Sidecar } from 'types/IstioObjects';
import { CopyToClipboard } from 'react-copy-to-clipboard';
import { style } from 'typestyle';
import { KialiIcon, defaultIconStyle } from '../../config/KialiIcon';
import { safeDumpOptions } from '../../types/IstioConfigDetails';
import { jsYaml } from '../../types/AceValidations';
import { EditResources } from './EditResources';
import { cloneDeep } from 'lodash';
import _ from 'lodash';

type PolicyItem = AuthorizationPolicy | Sidecar;

interface Props {
  isOpen: boolean;
  ns: string;
  authorizationPolicies: AuthorizationPolicy[];
  sidecars: Sidecar[];
  opTarget: string;
  onClose: () => void;
  onConfirm: (authorizationPolicies, sidecars) => void;
}

interface State {
  sidecars: Sidecar[];
  authorizationPolicies: AuthorizationPolicy[];
  mainTab: string;
}

const separator = '\n---\n\n';
const authorizationPoliciesTitle = 'Authorization Policies';
const sidecarsTitle = 'Sidecars';

export class IstioConfigPreview extends React.Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = {
      mainTab: authorizationPoliciesTitle.toLocaleLowerCase().replace(/\s/g, ''),
      sidecars: cloneDeep(this.props.sidecars),
      authorizationPolicies: cloneDeep(this.props.authorizationPolicies)
    };
  }

  componentDidUpdate(prevProps: Props) {
    if (
      !_.isEqual(prevProps.sidecars, this.props.sidecars) ||
      !_.isEqual(prevProps.authorizationPolicies, this.props.authorizationPolicies)
    ) {
      this.setStateValues(this.props.sidecars, this.props.authorizationPolicies);
    }
  }

  setStateValues = (sidecars: Sidecar[], authorizationPolicies: AuthorizationPolicy[]) => {
    this.setState({
      sidecars: cloneDeep(sidecars),
      authorizationPolicies: cloneDeep(authorizationPolicies)
    });
  };

  trafficToText = (
    authorizationPolicies: AuthorizationPolicy[] = this.state.authorizationPolicies,
    sidecars: Sidecar[] = this.state.sidecars
  ) => {
    var trafficPoliciesYaml = '';
    trafficPoliciesYaml = authorizationPolicies.map(obj => jsYaml.safeDump(obj, safeDumpOptions)).join(separator);
    trafficPoliciesYaml += separator;
    trafficPoliciesYaml += sidecars.map(obj => jsYaml.safeDump(obj, safeDumpOptions)).join(separator);
    return trafficPoliciesYaml;
  };

  downloadTraffic = () => {
    const element = document.createElement('a');
    const file = new Blob([this.trafficToText()], { type: 'text/plain' });
    element.href = URL.createObjectURL(file);
    element.download = 'trafficPolicies_' + this.props.ns + '.yaml';
    document.body.appendChild(element); // Required for this to work in FireFox
    element.click();
  };

  onConfirm = () => {
    this.props.onConfirm(this.state.authorizationPolicies, this.state.sidecars);
    this.setState({
      mainTab: authorizationPoliciesTitle.toLocaleLowerCase().replace(/\s/g, ''),
      sidecars: [],
      authorizationPolicies: []
    });
  };

  editorChange = (object: PolicyItem, index: number) => {
    const authorizationPolicies = this.state.authorizationPolicies;
    const sidecars = this.state.sidecars;
    object.metadata!.labels!['kiali_wizard'] === 'AuthorizationPolicy'
      ? (authorizationPolicies[index] = object as AuthorizationPolicy)
      : (sidecars[index] = object as Sidecar);
    this.setState({ sidecars, authorizationPolicies });
  };

  addResource = (title: string, items: PolicyItem[], orig: PolicyItem[]) => {
    const key = title.toLocaleLowerCase().replace(/\s/g, '');
    return (
      items.length > 0 && (
        <Tab eventKey={key} key={key} title={title}>
          <EditResources items={items} orig={orig} onChange={(obj, index) => this.editorChange(obj, index)} />
        </Tab>
      )
    );
  };

  render() {
    return (
      <Modal
        width={'75%'}
        title={'Preview Traffic Policies '}
        isOpen={this.props.isOpen}
        onClose={this.props.onClose}
        actions={[
          <Button key="cancel" variant="secondary" onClick={this.props.onClose}>
            Cancel
          </Button>,
          <Button
            key={this.props.opTarget}
            variant={this.props.opTarget === 'delete' ? 'danger' : 'primary'}
            onClick={this.onConfirm}
          >
            {this.props.opTarget && this.props.opTarget[0].toUpperCase() + this.props.opTarget.substr(1)}
          </Button>
        ]}
      >
        <Toolbar>
          <ToolbarGroup
            className={style({
              marginLeft: 'auto'
            })}
          >
            <ToolbarItem>
              <Tooltip content={<>Copy all resources</>}>
                <CopyToClipboard text={this.trafficToText()}>
                  <Button variant={ButtonVariant.link} aria-label="Copy" isInline>
                    <KialiIcon.Copy className={defaultIconStyle} />
                  </Button>
                </CopyToClipboard>
              </Tooltip>
            </ToolbarItem>
            <ToolbarItem>
              <Tooltip content={<>Download all resources in a file</>}>
                <Button
                  variant={ButtonVariant.link}
                  isInline
                  aria-label="Download"
                  className={style({ marginLeft: '0.5em' })}
                  onClick={() => this.downloadTraffic()}
                >
                  <KialiIcon.Download className={defaultIconStyle} />
                </Button>
              </Tooltip>
            </ToolbarItem>
          </ToolbarGroup>
        </Toolbar>
        {(this.state.authorizationPolicies.length > 0 || this.state.sidecars.length > 0) && (
          <Tabs
            activeKey={this.state.mainTab}
            onSelect={(_, tab) => this.setState({ mainTab: String(tab) })}
            isFilled={true}
          >
            {this.addResource(
              authorizationPoliciesTitle,
              this.state.authorizationPolicies,
              this.props.authorizationPolicies
            )}
            {this.addResource(sidecarsTitle, this.state.sidecars, this.props.sidecars)}
          </Tabs>
        )}
      </Modal>
    );
  }
}
