# This builds a container with the required tools to build a
# release of Kiali from a Jenkins pipeline.
#

# With some ideas taken from:
#  * https://getintodevops.com/blog/the-simple-way-to-run-docker-in-docker-for-ci
#  * https://github.com/sudo-bmitch/jenkins-docker
#  * https://github.com/rgoodwin/jenkins-master-preconfigured

FROM jenkins/jenkins:lts

# Install Jenkins plugins
RUN /usr/local/bin/install-plugins.sh credentials-binding email-ext git ssh-agent mailer \
        pipeline-stage-view rebuild timestamper workflow-aggregator ws-cleanup

# Install setup script and preconfigured jobs
COPY jenkins_ref /usr/share/jenkins/ref/

## Install tools
#
USER root

# Install entrypoint script
COPY bin/entrypoint.sh /usr/local/bin/

RUN set -eux; \
    # Install golang \
    curl -fsSL https://dl.google.com/go/go1.12.6.linux-amd64.tar.gz -o go.tar.gz; \
    tar -C /usr/local -zxf go.tar.gz; \
    rm go.tar.gz; \
    # Add Yarn repository \
    # curl -sS https://dl.yarnpkg.com/debian/pubkey.gpg | apt-key add -; \
    # echo "deb https://dl.yarnpkg.com/debian/ stable main" | tee /etc/apt/sources.list.d/yarn.list; \
    # Install NodeJs \
    curl -fsSL https://nodejs.org/dist/v10.16.0/node-v10.16.0-linux-x64.tar.xz -o node.tar.xz; \
    mkdir -p /usr/local/lib/nodejs; \
    tar -xJf node.tar.xz -C /usr/local/lib/nodejs; \
    rm node.tar.xz; \
    # Install Yarn \
    curl -fsSL https://dl.yarnpkg.com/debian/pubkey.gpg | gpg --import; \
    curl -fsSL https://yarnpkg.com/downloads/1.16.0/yarn-v1.16.0.tar.gz.asc -o yarn.tar.gz.asc; \
    curl -fsSL https://yarnpkg.com/downloads/1.16.0/yarn-v1.16.0.tar.gz -o yarn.tar.gz; \
    gpg --verify yarn.tar.gz.asc; \
    tar -C /usr/local -zxf yarn.tar.gz; \
    rm yarn.tar.gz yarn.tar.gz.asc; \
    # Add Docker apt-gpg \
    curl -fsSL https://download.docker.com/linux/debian/gpg | apt-key add -; \
    # Install packages required to setup Docker repositories \
    apt-get -qq update; \
    apt-get install --no-install-recommends -qq apt-transport-https software-properties-common; \
    # Add Docker repository \
    add-apt-repository \
      "deb [arch=amd64] https://download.docker.com/linux/debian \
      $(lsb_release -cs) \
      stable";\
    # Install tools: build tools, gosu, docker-cli \
    apt-get -qq update; \
    apt-get install --no-install-recommends -qq build-essential gosu docker-ce-cli; \
    # Create Docker group \
    groupadd -r docker; \
    usermod -aG docker jenkins; \
    # Clean-up \
    rm -rf /var/lib/apt/lists/*; \
    # Set exec permissions to entrypoint; \
    chmod +x /usr/local/bin/entrypoint.sh;

# Overide entrypoint of the base image with our own
ENTRYPOINT ["/usr/local/bin/entrypoint.sh"]

# Adjust PATH to include tools: golang, nodejs, yarn
ENV PATH "/usr/local/lib/nodejs/node-v10.16.0-linux-x64/bin:/usr/local/yarn-v1.16.0/bin:/usr/local/go/bin:$PATH"

# Skip Jenkins setup wizard
ENV JAVA_OPTS -Djenkins.install.runSetupWizard=false
