# Installing Istio With The Latest Sail and Kiali Operators

To install Istio with the latest release of the Sail and Kiali operators, use the script `install-ossm-release.sh`.

Here's what you need to do in order to install everything.

First, install an OpenShift cluster and make sure you do not already have Istio, Service Mesh, or Kiali installed. (Note: non-OpenShift clusters are not supported yet - when the Sail operator is published on OperatorHub.io, then these scripts should be able to work with some minor updates).

Second, log into this cluster as a cluster admin user via 'oc'.

Now install the Sail operators:

```
./install-ossm-release.sh install-operators
```

Once the operators have been given time to start up, now install a control plane with Istio and Kiali:

```
./install-ossm-release.sh install-istio
```

Pass in `--help` for available options.

## Uninstall

To uninstall, use the `delete-istio` and `delete-operators` commands.
