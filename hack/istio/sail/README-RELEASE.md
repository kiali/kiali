# Installing Istio with the Latest Sail and Kiali Operators

To install Istio (including Kiali), use the script `install-ossm-release.sh`. This will utilize the Sail operator and Kiali operator to install the latest released images via OLM using either the Red Hat repository or the public Community repository or the public OperatorHub.io.

Here's what you need to do in order to install everything.

First, install an OpenShift or Kubernetes cluster and make sure you do not already have Istio or Kiali installed.

Second, if using OpenShift, log into this cluster as a cluster admin user via 'oc'. Otherwise, make sure your current kube context is pointing to your Kubernetes cluster.

Now install the required operators:

```
./install-ossm-release.sh install-operators
```

Once the operators have been given time to start up, now install a control plane with Istio and Kiali:

```
./install-ossm-release.sh install-istio
```

Pass in `--help` for available options.

## Uninstall

To uninstall, use the `delete-istio` and `delete-operators` commands to the `./install-ossm-release.sh` script.
