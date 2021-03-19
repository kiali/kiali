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

## Install tools
#
USER root

# Install entrypoint script
COPY bin/entrypoint.sh /usr/local/bin/

RUN set -eux; \
    # Install golang \
    curl -fsSL https://golang.org/dl/go1.16.2.linux-amd64.tar.gz -o go.tar.gz; \
    tar -C /usr/local -zxf go.tar.gz; \
    rm go.tar.gz; \
    # Add Yarn repository \
    # curl -sS https://dl.yarnpkg.com/debian/pubkey.gpg | apt-key add -; \
    # echo "deb https://dl.yarnpkg.com/debian/ stable main" | tee /etc/apt/sources.list.d/yarn.list; \
    # Install NodeJs \
    curl -fsSL https://nodejs.org/dist/v14.16.0/node-v14.16.0-linux-x64.tar.gz -o node.tar.gz; \
    mkdir -p /usr/local/lib/nodejs; \
    tar -xzf node.tar.gz -C /usr/local/lib/nodejs; \
    rm node.tar.gz; \
    # Install Yarn \
    curl -fsSL https://dl.yarnpkg.com/debian/pubkey.gpg | gpg --import; \
    curl -fsSL https://yarnpkg.com/downloads/1.22.4/yarn-v1.22.4.tar.gz.asc -o yarn.tar.gz.asc; \
    curl -fsSL https://yarnpkg.com/downloads/1.22.4/yarn-v1.22.4.tar.gz -o yarn.tar.gz; \
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
    # Install some things to support generating operator all-in-one yaml (gettext-base has 'envsubst') \
    apt-get -qq install gettext-base; \
    # Install python2, required to build the UI \
    apt-get -qq --no-install-recommends install python; \
    # Create Docker group \
    groupadd -r docker; \
    usermod -aG docker jenkins; \
    # Clean-up \
    rm -rf /var/lib/apt/lists/*; \
    # Set exec permissions to entrypoint; \
    chmod +x /usr/local/bin/entrypoint.sh;

# Install setup script and preconfigured jobs
COPY jenkins_ref /usr/share/jenkins/ref/

# Overide entrypoint of the base image with our own
ENTRYPOINT ["/usr/local/bin/entrypoint.sh"]

# Adjust PATH to include tools: golang, nodejs, yarn
ENV PATH "/usr/local/lib/nodejs/node-v14.16.0-linux-x64/bin:/usr/local/yarn-v1.22.4/bin:/usr/local/go/bin:$PATH"

# Skip Jenkins setup wizard
ENV JAVA_OPTS -Djenkins.install.runSetupWizard=false
