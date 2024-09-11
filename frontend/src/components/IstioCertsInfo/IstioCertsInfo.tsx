import * as React from 'react';
import { Grid, GridItem } from '@patternfly/react-core';
import { CertsInfo } from 'types/CertsInfo';

type IstioCertsInfoProps = {
  certificates: CertsInfo[];
};

const IstioCertsInfoComponent: React.FC<IstioCertsInfoProps> = (props: IstioCertsInfoProps) => {
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
              <ul>
                {certInfo.dnsNames.map((dnsName, index) => (
                  <li key={index}>{dnsName}</li>
                ))}
              </ul>
            </GridItem>
          </>
        )}
      </Grid>
    );
  };

  const showCertError = (certInfo: CertsInfo): JSX.Element => {
    return <p>Certificate error: {certInfo.error}</p>;
  };

  return (
    <div data-test="control-plane-certificate">
      <p style={{ marginBottom: '5px' }}>Certificates</p>
      <ul>
        {props.certificates.map((certInfo, index) => (
          <li key={index} style={{ marginBottom: '15px' }}>
            <p>From {certInfo.configMapName} config map</p>
            {!certInfo.error && showCertInfo(certInfo)}
            {certInfo.error && showCertError(certInfo)}
          </li>
        ))}
      </ul>
    </div>
  );
};

export const IstioCertsInfo = IstioCertsInfoComponent;
