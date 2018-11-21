# This builds a container with the required tools to build, test and generate a
# release of Kiali from a Jenkins pipeline.
#

FROM centos:7

RUN yum group install -y 'Development Tools'
RUN curl -sL https://rpm.nodesource.com/setup_11.x | bash -
RUN curl --silent --location https://dl.yarnpkg.com/rpm/yarn.repo | tee /etc/yum.repos.d/yarn.repo 
RUN yum install -y npm yarn
RUN curl -s https://dl.google.com/go/go1.11.2.linux-amd64.tar.gz -o go.tar.gz && \
  tar -C /usr/local -zxf go.tar.gz && \
  rm go.tar.gz
COPY bin/jq bin/semver /usr/local/bin/
RUN chown root:root /usr/local/bin/jq /usr/local/bin/semver && useradd -ms /bin/bash jenkins
USER jenkins
WORKDIR /home/jenkins
ENV PATH "$PATH:/usr/local/go/bin"
