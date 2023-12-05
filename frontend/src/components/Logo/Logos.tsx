import * as React from 'react';
import { kialiStyle } from 'styles/StyleUtils';

import GrpcIcon from '../../assets/img/api/grpc.svg';
import RestIcon from '../../assets/img/api/rest.svg';
import GraphqlIcon from '../../assets/img/api/graphql.svg';
import VertxLogo from '../../assets/img/runtime/vertx.svg';
import NodejsLogo from '../../assets/img/runtime/nodejs.svg';
import ThorntailLogo from '../../assets/img/runtime/thorntail.svg';
import GoLogo from '../../assets/img/runtime/go.svg';
import MicroProfileLogo from '../../assets/img/runtime/microprofile.svg';
import JVMLogo from '../../assets/img/runtime/java.svg';
import SpringBootLogo from '../../assets/img/runtime/spring-boot.svg';
import QuarkusLogo from '../../assets/img/runtime/quarkus.svg';
import TomcatLogo from '../../assets/img/runtime/tomcat.svg';

const iconStyle = kialiStyle({
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
  renderLogo(name, name, idx, runtimesLogos, iconStyle);

// API types
const apiLogos = {
  grpc: GrpcIcon,
  rest: RestIcon,
  graphql: GraphqlIcon
};

export const renderAPILogo = (name: string, title: string | undefined, idx: number): React.ReactNode =>
  renderLogo(name, title, idx, apiLogos, iconStyle);
