# servicemesh-plugin
OpenShift Dynamic Plugin for ServiceMesh

## Run Kiali and OpenShift Console in a local environment

Install an OpenShift platform.

This plugin is being developed using [Red Hat OpenShift Local](https://developers.redhat.com/products/openshift-local/overview) but any other plaform should work.

Using CRC a local installation consists in:

```
crc stop
crc cleanup
crc start

# Setup oc command if you don't have one
eval $(crc oc-env)

oc config use-context crc-admin

# Install Istio on top of OpenShift
$KIALI_HOME/hack/istio/install-istio-via-istioctl.sh

# Install demos used for testing
$KIALI_HOME/hack/istio/install-testing-demos.sh -c "oc"
```

In one terminal window, run Kiali in standalone and using the plugins flag:

```
cd $KIALI_HOME

make build-plugin-openshift

hack/run-kiali.sh --kube-context current --plugin-openshift-enabled
```

In another window, run:

```
# Make sure you are logged into OpenShift i.e. oc login
cd $KIALI_HOME

hack/run-openshift-console.sh 
```

# Local development

In one terminal window, run:

1. `yarn install`
2. `yarn run start`

In another terminal window, run:

1. `oc login`
2. `yarn run start-console` (requires [Docker](https://www.docker.com) or [podman](https://podman.io))

This will run the OpenShift console in a container connected to the cluster
you've logged into. The plugin HTTP server runs on port 9001 with CORS enabled.

## References

[Dynamic Plugins Doc](https://github.com/openshift/enhancements/blob/master/enhancements/console/dynamic-plugins.md)
[Dynamic Plugins SDK](https://github.com/openshift/console/tree/master/frontend/packages/console-dynamic-plugin-sdk#readme)
