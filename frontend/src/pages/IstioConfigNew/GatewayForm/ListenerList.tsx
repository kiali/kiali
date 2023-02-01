import * as React from 'react';
import {cellWidth, TableComposable, Tbody, Th, Thead, Tr} from '@patternfly/react-table';
import { style } from 'typestyle';
import { PFColors } from '../../../components/Pf/PfColors';
import {Button, ButtonVariant} from "@patternfly/react-core";
import {PlusCircleIcon} from "@patternfly/react-icons";
import { Listener } from "../../../types/IstioObjects";
import {ListenerForm} from "../K8sGatewayForm";
import ListenerBuilder from "./ListenerBuilder";

type Props = {
  onChange: (listener: Listener[], listenerForm: ListenerForm[]) => void;
  listenersForm: ListenerForm[]
  listeners: Listener[]
};

const noListenerStyle = style({
  marginTop: 10,
  color: PFColors.Red100,
  textAlign: 'center',
  width: '100%'
});

const addListenerStyle = style({
  marginLeft: 0,
  paddingLeft: 0
});

const headerCells = [
  {
    title: 'Name',
    transforms: [cellWidth(20) as any],
    props: {}
  },
  {
    title: 'Hostname',
    transforms: [cellWidth(20) as any],
    props: {}
  },
  {
    title: 'Port',
    transforms: [cellWidth(10) as any],
    props: {}
  },
  {
    title: 'Protocol',
    transforms: [cellWidth(10) as any],
    props: {}
  },
  {
    title: 'From Namespaces',
    transforms: [cellWidth(10) as any],
    props: {}
  },
  {
    title: 'Labels',
    transforms: [cellWidth(25) as any],
    props: {}
  },
  {
    title: '',
    transforms: [cellWidth(10) as any],
    props: {}
  }
];

export const addSelectorLabels = (value: string) => {
  if (value.length === 0) {
    return;
  }
  value = value.trim();
  const labels: string[] = value.split(',');

  const selector: { [key: string]: string } = {};
  // Some smoke validation rules for the labels
  for (let i = 0; i < labels.length; i++) {
    const label = labels[i];
    if (label.indexOf('=') < 0) {
      break;
    }
    const splitLabel: string[] = label.split('=');
    if (splitLabel.length !== 2) {
      break;
    }
    if (splitLabel[0].trim().length === 0 || splitLabel[1].trim().length === 0) {
      break;
    }
    selector[splitLabel[0].trim()] = splitLabel[1].trim();
  }
  return selector;
};

type ListenerListState = {
  keyFocus: string
}

class ListenerList extends React.Component<Props, ListenerListState> {

  constructor(props) {
    super(props);
  }

  onAddListener = () => {
    const newListener : ListenerForm = {
      hostname: '',
      port: '',
      name: '',
      protocol: 'HTTP',
      isHostValid: false,
      from: '',
      isLabelSelectorValid: false,
      sSelectorLabels: ''
    }
    const l = this.props.listenersForm
    l.push(newListener)
    this.setState(
      {},
      () => this.props.onChange(this.props.listeners, l)
    );
  };

  onRemoveListener = (index: number) => {
    const l = this.props.listenersForm
    l.splice(index,1)
    this.setState(
      {},
      () => this.props.onChange(this.props.listeners, l)
    );

  };

  onChange = (listenersForm: ListenerForm, i: number) => {
    const lf = this.props.listenersForm
    lf[i] = listenersForm

    const l = this.props.listeners
    const newL = this.createNewListener(listenersForm)
    if (typeof(newL) !== "undefined") {
      l[i] = newL
    }

    this.props.onChange(l, lf)
  }

  createNewListener = (listenerForm: ListenerForm) => {

    if (isNaN(Number(listenerForm.port))) return;
    const selector = addSelectorLabels(listenerForm.sSelectorLabels)
    if (typeof(selector) === "undefined") return;

    const listener : Listener = {
      hostname: listenerForm.hostname,
      port: Number(listenerForm.port),
      name: listenerForm.name,
      protocol: listenerForm.protocol,
      allowedRoutes: {namespaces: {from: listenerForm.from, selector: {matchLabels: selector}}}
    }
    return listener
  }

  render() {
    return (
      <>
        <TableComposable
          aria-label="Listener List"
        >
          <Thead>
            <Tr>
            {headerCells.map((e) => (
              <Th>{e.title}</Th>
            ))}
            </Tr>
          </Thead>
          <Tbody>
            {this.props.listenersForm.map((listener, i) => (
                <ListenerBuilder listener={listener}
                                 onRemoveListener={this.onRemoveListener}
                                 index={i}
                                 onChange={this.onChange}
                ></ListenerBuilder>
            ))}
            <Tr key="addTable">
              <Button
                variant={ButtonVariant.link}
                icon={<PlusCircleIcon/>}
                onClick={this.onAddListener}
                className={addListenerStyle}
              >
                Add Listener to Listener List
              </Button>
            </Tr>
          </Tbody>
        </TableComposable>
        {(this.props.listenersForm.length === 0) && (<div className={noListenerStyle}>No Listeners defined</div>)}
      </>
    );
  }
}

export default ListenerList;
