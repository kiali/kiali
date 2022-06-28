import * as React from 'react';
import * as API from '../../services/Api';
import {
  Button,
  Card,
  CardBody,
  CardHeader,
  Grid,
  GridItem,
  Modal,
  ModalVariant,
  Title,
  TitleSizes,
  Tooltip,
  TooltipPosition
} from '@patternfly/react-core';
import { KialiAppState } from 'store/Store';
import { istioCertsInfoSelector, lastRefreshAtSelector } from 'store/Selectors';
import { ThunkDispatch } from 'redux-thunk';
import { KialiAppAction } from 'actions/KialiAppAction';
import { bindActionCreators } from 'redux';
import { IstioCertsInfoActions } from 'actions/IstioCertsInfoActions';
import { connect } from 'react-redux';
import { TimeInMilliseconds } from 'types/Common';
import { CertsInfo } from 'types/CertsInfo';
import { PFColors } from 'components/Pf/PfColors';
import { KialiIcon } from 'config/KialiIcon';
import { infoStyle } from 'styles/DropdownStyles';

type IstioCertsInfoState = {
  showModal: boolean;
  certsError: Boolean;
};

type ReduxProps = {
  lastRefreshAt: TimeInMilliseconds;
  setIstioCertsInfo: (istioCertsInfo: CertsInfo[]) => void;
  certsInfo: CertsInfo[];
};

type IstioCertsInfoProps = ReduxProps & {
  ref: React.RefObject<any>;
};

class IstioCertsInfo extends React.Component<IstioCertsInfoProps, IstioCertsInfoState> {
  constructor(props: IstioCertsInfoProps) {
    super(props);
    this.state = { showModal: false, certsError: false };
  }

  open = () => {
    this.setState({ showModal: true });
  };

  close = () => {
    this.setState({ showModal: false });
  };

  componentDidMount() {
    this.fetchStatus();
  }

  componentDidUpdate(prevProps: Readonly<IstioCertsInfoProps>): void {
    if (this.props.lastRefreshAt !== prevProps.lastRefreshAt) {
      this.fetchStatus();
    }
  }

  fetchStatus = () => {
    API.getIstioCertsInfo()
      .then(response => {
        this.props.setIstioCertsInfo(response.data);
        this.setState({ certsError: false });
      })
      .catch(_error => {
        this.setState({ certsError: true });
      });
  };

  showCertInfo = (certInfo: CertsInfo): JSX.Element => {
    return (
      <Grid>
        <GridItem span={3}>
          <b>Issuer</b>
        </GridItem>
        <GridItem span={9}>{certInfo.issuer}</GridItem>
        <GridItem span={3}>
          <b>Valid from</b>
        </GridItem>
        <GridItem span={9}>{certInfo.notBefore}</GridItem>
        <GridItem span={3}>
          <b>Valid until</b>
        </GridItem>
        <GridItem span={9}>{certInfo.notAfter}</GridItem>
        {certInfo.dnsNames && (
          <>
            <GridItem span={3}>
              <b>DNS Names</b>
            </GridItem>
            <GridItem span={9}>
              {certInfo.dnsNames && certInfo.dnsNames.map((dnsName, index) => <li key={index}>{dnsName}</li>)}
            </GridItem>
          </>
        )}
      </Grid>
    );
  };

  render() {
    return (
      <Modal
        variant={ModalVariant.small}
        isOpen={this.state.showModal}
        onClose={this.close}
        title="Certificates information"
        actions={[<Button onClick={this.close}>Close</Button>]}
      >
        {this.state.certsError && (
          <p style={{ color: PFColors.Danger }}>An error occurred getting certificates information</p>
        )}
        <ul>
          {this.props.certsInfo &&
            !this.state.certsError &&
            this.props.certsInfo.map((certInfo, index) => (
              <li key={index}>
                <Card>
                  <CardHeader>
                    <Title headingLevel="h3" size={TitleSizes.lg}>
                      From {certInfo.secretName} secret
                    </Title>
                  </CardHeader>
                  <CardBody>
                    <Grid>
                      <GridItem span={12}>
                        {certInfo.error && (
                          <p style={{ color: PFColors.Danger }}>An error occurred, {certInfo.error}</p>
                        )}
                        {!certInfo.accessible && (
                          <Tooltip
                            position={TooltipPosition.right}
                            content={
                              <div style={{ textAlign: 'left' }}>
                                <p>
                                  For security purposes, Kiali has not been granted permission to view this certificate.
                                  If you want Kiali to provide details about this certificate then you must grant the
                                  Kiali service account permission to read the secret {certInfo.secretName} found in
                                  namespace {certInfo.secretNamespace}.
                                </p>
                                <p style={{ marginTop: '20px' }}>
                                  Refer to the Kiali documentation for details on how you can add this permission.
                                </p>
                              </div>
                            }
                          >
                            <span>
                              Access denied <KialiIcon.Warning className={infoStyle} />
                            </span>
                          </Tooltip>
                        )}
                      </GridItem>
                    </Grid>
                    {!certInfo.error && certInfo.accessible && this.showCertInfo(certInfo)}
                  </CardBody>
                </Card>
              </li>
            ))}
        </ul>
      </Modal>
    );
  }
}

const mapStateToProps = (state: KialiAppState) => ({
  certsInfo: istioCertsInfoSelector(state),
  lastRefreshAt: lastRefreshAtSelector(state)
});

const mapDispatchToProps = (dispatch: ThunkDispatch<KialiAppState, void, KialiAppAction>) => ({
  setIstioCertsInfo: bindActionCreators(IstioCertsInfoActions.setinfo, dispatch)
});

const IstioCertsInfoConnected = connect(mapStateToProps, mapDispatchToProps, null, { forwardRef: true })(
  IstioCertsInfo
);

export default IstioCertsInfoConnected;
