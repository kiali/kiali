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
import { istioCertsInfoSelector } from 'store/Selectors';
import { KialiDispatch } from 'types/Redux';
import { bindActionCreators } from 'redux';
import { IstioCertsInfoActions } from 'actions/IstioCertsInfoActions';
import { connect } from 'react-redux';
import { TimeInMilliseconds } from 'types/Common';
import { CertsInfo } from 'types/CertsInfo';
import { PFColors } from 'components/Pf/PfColors';
import { KialiIcon } from 'config/KialiIcon';
import { infoStyle } from 'styles/DropdownStyles';
import { connectRefresh } from '../Refresh/connectRefresh';
import { kialiStyle } from 'styles/StyleUtils';

type ReduxProps = {
  certsInfo: CertsInfo[];
  setIstioCertsInfo: (istioCertsInfo: CertsInfo[]) => void;
};

type IstioCertsInfoProps = ReduxProps & {
  isOpen: boolean;
  lastRefreshAt: TimeInMilliseconds;
  onClose: () => void;
};

const cardStyle = kialiStyle({
  border: `1px solid ${PFColors.BorderColor100}`
});

const IstioCertsInfoComponent: React.FC<IstioCertsInfoProps> = (props: IstioCertsInfoProps) => {
  const [certsError, setCertsError] = React.useState<boolean>(false);

  const { setIstioCertsInfo } = props;

  const fetchStatus = React.useCallback(() => {
    API.getIstioCertsInfo()
      .then(response => {
        setIstioCertsInfo(response.data);
        setCertsError(false);
      })
      .catch(_error => {
        setCertsError(true);
      });
  }, [setIstioCertsInfo]);

  React.useEffect(() => {
    fetchStatus();
  }, [props.lastRefreshAt, fetchStatus]);

  const showCertInfo = (certInfo: CertsInfo): JSX.Element => {
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

  return (
    <Modal
      variant={ModalVariant.small}
      isOpen={props.isOpen}
      onClose={props.onClose}
      title="Certificates information"
      actions={[<Button onClick={close}>Close</Button>]}
    >
      {certsError && <p style={{ color: PFColors.Danger }}>An error occurred getting certificates information</p>}
      <ul>
        {props.certsInfo &&
          !certsError &&
          props.certsInfo.map((certInfo, index) => (
            <li key={index}>
              <Card className={cardStyle}>
                <CardHeader>
                  <Title headingLevel="h3" size={TitleSizes.lg}>
                    From {certInfo.secretName} secret
                  </Title>
                </CardHeader>
                <CardBody>
                  <Grid>
                    <GridItem span={12}>
                      {certInfo.error && <p style={{ color: PFColors.Danger }}>An error occurred, {certInfo.error}</p>}
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
                              <p style={{ marginTop: '1.25rem' }}>
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
                  {!certInfo.error && certInfo.accessible && showCertInfo(certInfo)}
                </CardBody>
              </Card>
            </li>
          ))}
      </ul>
    </Modal>
  );
};

const mapStateToProps = (state: KialiAppState) => ({
  certsInfo: istioCertsInfoSelector(state)
});

const mapDispatchToProps = (dispatch: KialiDispatch) => ({
  setIstioCertsInfo: bindActionCreators(IstioCertsInfoActions.setinfo, dispatch)
});

export const IstioCertsInfo = connectRefresh(connect(mapStateToProps, mapDispatchToProps)(IstioCertsInfoComponent));
