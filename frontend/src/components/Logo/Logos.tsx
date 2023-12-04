import * as React from 'react';
import { kialiStyle } from 'styles/StyleUtils';

import GrpcIcon from '../../assets/img/grpc-logo.svg';
import RestIcon from '../../assets/img/rest-logo.svg';
import GraphqlIcon from '../../assets/img/graphql-logo.svg';
import VertxLogo from '../../assets/img/vertx-logo.png';
import NodejsLogo from '../../assets/img/nodejs-logo.svg';
import ThorntailLogo from '../../assets/img/thorntail-logo.png';
import GoLogo from '../../assets/img/go-logo.svg';
import MicroProfileLogo from '../../assets/img/microprofile-logo.svg';
import JVMLogo from '../../assets/img/java-logo.png';
import SpringBootLogo from '../../assets/img/thorntail-logo.png';
import QuarkusLogo from '../../assets/img/thorntail-logo.png';
import TomcatLogo from '../../assets/img/thorntail-logo.png';

const apiIconStyle = kialiStyle({
  height: '2rem',
  marginBottom: '0.125rem'
});

const runtimeIconStyle = kialiStyle({
  height: '1.5rem'
});

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
  Go: GoLogo,
  JVM: JVMLogo,
  MicroProfile: MicroProfileLogo,
  'Node.js': NodejsLogo,
  Quarkus: QuarkusLogo,
  'Spring Boot': SpringBootLogo,
  Thorntail: ThorntailLogo,
  Tomcat: TomcatLogo,
  'Vert.x': VertxLogo
};

export const renderRuntimeLogo = (name: string, idx: number): React.ReactNode =>
  renderLogo(name, name, idx, runtimesLogos, runtimeIconStyle);

// API types
const apiLogos = {
  grpc: GrpcIcon,
  rest: RestIcon,
  graphql: GraphqlIcon
};

export const renderAPILogo = (name: string, title: string | undefined, idx: number): React.ReactNode =>
  renderLogo(name, title, idx, apiLogos, apiIconStyle);
