import * as React from 'react';
import { kialiStyle } from 'styles/StyleUtils';

import GrpcIcon from '../../assets/img/grpc-logo.svg';
import RestIcon from '../../assets/img/rest-logo.svg';
import GraphqlIcon from '../../assets/img/graphql-logo.svg';
import VertxLogo from '../../assets/img/vertx-logo.png';
import NodejsLogo from '../../assets/img/nodejs-logo.png';
import ThorntailLogo from '../../assets/img/thorntail-logo.png';
import GoLogo from '../../assets/img/go-logo.png';
import MicroProfileLogo from '../../assets/img/microprofile-logo.png';
import JVMLogo from '../../assets/img/java-logo.png';

const renderLogo = (
  name: string,
  title: string | undefined,
  idx: number,
  logoSet: { [key: string]: any },
  className?: string
): React.ReactNode => {
  const logo = logoSet[name];

  if (logo) {
    return <img key={`logo-${idx}`} src={logo} alt={name} title={title} className={className} />;
  }

  return <span key={`logo-${idx}`}>{name}</span>;
};

// Runtimes
const runtimesLogos = {
  'Vert.x': VertxLogo,
  'Node.js': NodejsLogo,
  Thorntail: ThorntailLogo,
  Go: GoLogo,
  MicroProfile: MicroProfileLogo,
  JVM: JVMLogo
};

export const renderRuntimeLogo = (name: string, idx: number): React.ReactNode =>
  renderLogo(name, name, idx, runtimesLogos);

// API types
const apiLogos = {
  grpc: GrpcIcon,
  rest: RestIcon,
  graphql: GraphqlIcon
};

const iconStyle = kialiStyle({
  height: '2rem',
  marginBottom: '0.125rem'
});

export const renderAPILogo = (name: string, title: string | undefined, idx: number): React.ReactNode =>
  renderLogo(name, title, idx, apiLogos, iconStyle);
