import * as React from 'react';
import { FormGroup, FormSelect, FormSelectOption } from '@patternfly/react-core';
import { K8sReferenceRule } from '../../types/IstioObjects';
import { Namespace } from '../../types/Namespace';
import { KialiAppState } from '../../store/Store';
import { namespaceItemsSelector } from '../../store/Selectors';
import { KialiDispatch } from '../../types/Redux';
import { NamespaceThunkActions } from '../../actions/NamespaceThunkActions';
import { connect } from 'react-redux';

export const K8S_REFERENCE_GRANT = 'K8sReferenceGrant';
export const K8S_REFERENCE_GRANTS = 'k8sreferencegrants';

export const FROM_KINDS = {
  HTTPRoute: 'gateway.networking.k8s.io',
  Gateway: 'gateway.networking.k8s.io'
};

export const TO_KINDS = {
  Service: '',
  Secret: ''
};

type ReduxStateProps = {
  namespaces: Namespace[];
};

type ReduxDispatchProps = {
  refresh: () => void;
};

type Props = ReduxStateProps &
  ReduxDispatchProps & {
    k8sReferenceGrant: K8sReferenceGrantState;
    onChange: (k8sReferenceGrant: K8sReferenceGrantState) => void;
  };

export type K8sReferenceGrantState = {
  from: K8sReferenceRule[];
  to: K8sReferenceRule[];
};

export const initK8sReferenceGrant = (): K8sReferenceGrantState => ({
  from: [
    {
      kind: Object.keys(FROM_KINDS)[0],
      group: Object.values(FROM_KINDS)[0],
      namespace: ''
    }
  ],
  to: [{ kind: Object.keys(TO_KINDS)[0], group: Object.values(TO_KINDS)[0] }]
});

export const isK8sReferenceGrantStateValid = (g: K8sReferenceGrantState): boolean => {
  return g.from.length > 0 && g.to.length > 0;
};

export class K8sReferenceGrantFormComponent extends React.Component<Props, K8sReferenceGrantState> {
  constructor(props: Props) {
    super(props);
    this.state = initK8sReferenceGrant();
  }

  componentDidMount(): void {
    this.props.k8sReferenceGrant.from[0].namespace = this.props.namespaces[0].name;
    this.setState(this.props.k8sReferenceGrant);
  }

  onChangeReferenceGrantFromKind = (_event: React.FormEvent, value: string): void => {
    this.setState(
      {
        from: [{ group: FROM_KINDS[value], kind: value, namespace: this.state.from[0].namespace }]
      },
      () => this.props.onChange(this.state)
    );
  };

  onChangeReferenceGrantFromNamespace = (_event: React.FormEvent, value: string): void => {
    this.setState(
      {
        from: [{ group: this.state.from[0].group, kind: this.state.from[0].kind, namespace: value }]
      },
      () => this.props.onChange(this.state)
    );
  };

  onChangeReferenceGrantToKind = (_event: React.FormEvent, value: string): void => {
    this.setState(
      {
        to: [{ group: TO_KINDS[value], kind: value }]
      },
      () => this.props.onChange(this.state)
    );
  };

  render(): React.ReactNode {
    return (
      <>
        <FormGroup label="From Namespace" fieldId="FromNamespace">
          <FormSelect
            value={this.state.from[0].namespace}
            onChange={this.onChangeReferenceGrantFromNamespace}
            id="ReferenceGrantFromNamespace"
            name="ReferenceGrantFromNamespace"
          >
            {this.props.namespaces.map((option, index) => (
              <FormSelectOption key={index} value={option.name} label={option.name} />
            ))}
          </FormSelect>
        </FormGroup>
        <FormGroup label="From Kind" fieldId="FromKind">
          <FormSelect
            value={this.state.from[0].kind}
            onChange={this.onChangeReferenceGrantFromKind}
            id="ReferenceGrantFromKind"
            name="ReferenceGrantFromKind"
          >
            {Object.keys(FROM_KINDS).map((fromKey: string, index: number) => (
              <FormSelectOption key={index} value={fromKey} label={fromKey} />
            ))}
          </FormSelect>
        </FormGroup>
        <FormGroup label="To Kind" fieldId="ToKind">
          <FormSelect
            value={this.state.to[0].kind}
            onChange={this.onChangeReferenceGrantToKind}
            id="ReferenceGrantToKind"
            name="ReferenceGrantToKind"
          >
            {Object.keys(TO_KINDS).map((toKey: string, index: number) => (
              <FormSelectOption key={index} value={toKey} label={toKey} />
            ))}
          </FormSelect>
        </FormGroup>
      </>
    );
  }
}

const mapStateToProps = (state: KialiAppState): ReduxStateProps => {
  return {
    namespaces: namespaceItemsSelector(state)!
  };
};

const mapDispatchToProps = (dispatch: KialiDispatch): ReduxDispatchProps => {
  return {
    refresh: () => {
      dispatch(NamespaceThunkActions.fetchNamespacesIfNeeded());
    }
  };
};

export const K8sReferenceGrantForm = connect(mapStateToProps, mapDispatchToProps)(K8sReferenceGrantFormComponent);
