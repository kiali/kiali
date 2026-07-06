# Install ACM Hub + Spoke (Two-Cluster Setup)

This runbook installs Red Hat Advanced Cluster Management (ACM) on two
OpenShift clusters: one as the **hub** and the other as a **managed spoke**.
The hub automatically self-manages as `local-cluster`, so no extra
configuration is needed for that.

## Assumptions

- You have two OpenShift clusters accessible via kubeconfig contexts named
  `my-hub` (the hub) and `my-spoke` (the spoke).
- Both contexts are defined in `~/.kube/config`.
- You have `cluster-admin` privileges on both clusters.
- The `oc` CLI is installed and available in PATH.

---

## Phase 0: Prerequisites

Verify connectivity and permissions on both clusters before proceeding.

```bash
# Verify you can reach the hub cluster
oc --context=my-hub whoami
oc --context=my-hub auth can-i create namespaces --all-namespaces

# Verify you can reach the spoke cluster
oc --context=my-spoke whoami
oc --context=my-spoke auth can-i create namespaces --all-namespaces
```

Both commands must succeed with cluster-admin access. If either fails, fix
connectivity or credentials before continuing.

---

## Phase 1: Install ACM Hub (on my-hub)

All commands in this phase target the hub cluster via `--context=my-hub`.

### Step 1.1: Determine the Latest ACM Version

Query the operator catalog to discover available ACM channels:

```bash
oc --context=my-hub get packagemanifest advanced-cluster-management \
  -n openshift-marketplace \
  -o jsonpath='{.status.channels[*].name}'
```

This returns a space-separated list of channels like
`release-2.14 release-2.15 release-2.16`. Select the highest numbered
`release-X.Y` channel.

**STOP: Present the discovered channel to the user and wait for confirmation
before proceeding.** For example: "The latest available ACM channel is
`release-2.16`. Shall I proceed with this version?"

Store the confirmed channel in a variable for subsequent steps:

```bash
ACM_CHANNEL="release-X.Y"  # Replace X.Y with the confirmed version
```

### Step 1.2: Create the ACM Namespace

```bash
oc --context=my-hub create namespace open-cluster-management
```

If the namespace already exists, this step can be skipped.

### Step 1.3: Create the OperatorGroup

```bash
oc --context=my-hub apply -f - <<'EOF'
apiVersion: operators.coreos.com/v1
kind: OperatorGroup
metadata:
  name: acm-operator-group
  namespace: open-cluster-management
spec:
  targetNamespaces:
  - open-cluster-management
EOF
```

### Step 1.4: Create the Subscription

```bash
oc --context=my-hub apply -f - <<EOF
apiVersion: operators.coreos.com/v1alpha1
kind: Subscription
metadata:
  name: advanced-cluster-management
  namespace: open-cluster-management
spec:
  channel: ${ACM_CHANNEL}
  installPlanApproval: Automatic
  name: advanced-cluster-management
  source: redhat-operators
  sourceNamespace: openshift-marketplace
EOF
```

### Step 1.5: Wait for the Operator CSV to Succeed

Poll until the ClusterServiceVersion reaches the `Succeeded` phase. This
typically takes 2-5 minutes.

```bash
# Wait for the CSV to appear
echo "Waiting for ACM CSV to appear..."
while true; do
  CSV_NAME=$(oc --context=my-hub get csv -n open-cluster-management \
    -o jsonpath='{.items[?(@.spec.displayName=="Advanced Cluster Management for Kubernetes")].metadata.name}' 2>/dev/null)
  if [ -n "$CSV_NAME" ]; then
    break
  fi
  sleep 10
done
echo "Found CSV: $CSV_NAME"

# Wait for it to succeed
oc --context=my-hub wait csv/$CSV_NAME \
  -n open-cluster-management \
  --for=jsonpath='{.status.phase}'=Succeeded \
  --timeout=600s
```

### Step 1.6: Create the MultiClusterHub

```bash
oc --context=my-hub apply -f - <<'EOF'
apiVersion: operator.open-cluster-management.io/v1
kind: MultiClusterHub
metadata:
  name: multiclusterhub
  namespace: open-cluster-management
spec: {}
EOF
```

### Step 1.7: Wait for MultiClusterHub to Reach Running

The MultiClusterHub can take 10-15 minutes to fully deploy. Poll the status:

```bash
echo "Waiting for MultiClusterHub to reach Running status..."
while true; do
  PHASE=$(oc --context=my-hub get mch multiclusterhub \
    -n open-cluster-management \
    -o jsonpath='{.status.phase}' 2>/dev/null)
  if [ "$PHASE" = "Running" ]; then
    echo "MultiClusterHub is Running"
    break
  fi
  echo "  Current phase: $PHASE"
  sleep 15
done
```

### Step 1.8: Verify Hub Self-Management (local-cluster)

The hub automatically imports itself as a managed cluster named
`local-cluster`. Verify it exists and is available:

```bash
oc --context=my-hub get managedcluster local-cluster
```

Expected output should show `JOINED` as True and `AVAILABLE` as True. If
`local-cluster` does not appear yet, wait a few minutes -- it is created
automatically as part of the MultiClusterHub reconciliation.

---

## Phase 2: Import my-spoke as a Managed Cluster

All commands in this phase run against the **hub** cluster (`my-hub` context)
unless explicitly noted otherwise.

### Step 2.1: Create a Namespace for the Spoke on the Hub

The namespace name must match the managed cluster name:

```bash
oc --context=my-hub create namespace my-spoke
```

### Step 2.2: Create the ManagedCluster Resource

```bash
oc --context=my-hub apply -f - <<'EOF'
apiVersion: cluster.open-cluster-management.io/v1
kind: ManagedCluster
metadata:
  name: my-spoke
  labels:
    cloud: auto-detect
    vendor: auto-detect
spec:
  hubAcceptsClient: true
EOF
```

### Step 2.3: Extract the Spoke Kubeconfig

The auto-import-secret needs a standalone kubeconfig for the spoke cluster.
Extract the `my-spoke` context from `~/.kube/config` into its own file:

```bash
oc config view --context=my-spoke --minify --flatten > /tmp/my-spoke-kubeconfig.yaml
```

Verify it works:

```bash
oc --kubeconfig=/tmp/my-spoke-kubeconfig.yaml whoami
```

### Step 2.4: Create the Auto-Import Secret

Create the secret on the hub with the spoke's kubeconfig content:

```bash
oc --context=my-hub create secret generic auto-import-secret \
  -n my-spoke \
  --from-file=kubeconfig=/tmp/my-spoke-kubeconfig.yaml
```

The ACM import controller will detect this secret and automatically install
the klusterlet agent on the spoke cluster.

### Step 2.5: Create the KlusterletAddonConfig

Enable ACM add-ons on the spoke cluster:

```bash
oc --context=my-hub apply -f - <<'EOF'
apiVersion: agent.open-cluster-management.io/v1
kind: KlusterletAddonConfig
metadata:
  name: my-spoke
  namespace: my-spoke
spec:
  applicationManager:
    enabled: true
  certPolicyController:
    enabled: true
  policyController:
    enabled: true
  searchCollector:
    enabled: true
EOF
```

### Step 2.6: Wait for the Spoke to Join

Poll until the managed cluster shows as joined and available:

```bash
echo "Waiting for my-spoke to join and become available..."
while true; do
  STATUS=$(oc --context=my-hub get managedcluster my-spoke \
    -o jsonpath='{range .status.conditions[*]}{.type}={.status}{" "}{end}' 2>/dev/null)
  echo "  Status: $STATUS"
  if echo "$STATUS" | grep -q "ManagedClusterJoined=True" && \
     echo "$STATUS" | grep -q "ManagedClusterConditionAvailable=True"; then
    echo "my-spoke is joined and available!"
    break
  fi
  sleep 15
done
```

### Step 2.7: Clean Up Temporary Kubeconfig

```bash
rm -f /tmp/my-spoke-kubeconfig.yaml
```

---

## Phase 3: Verification

Confirm both clusters are managed by the hub:

```bash
oc --context=my-hub get managedclusters
```

Expected output should list two clusters:

| NAME | HUB ACCEPTED | MANAGED CLUSTER URLS | JOINED | AVAILABLE |
|------|-------------|---------------------|--------|-----------|
| local-cluster | true | ... | True | True |
| my-spoke | true | ... | True | True |

You can also verify the klusterlet agent is running on the spoke:

```bash
oc --context=my-spoke get pods -n open-cluster-management-agent
```

And verify add-on agents are running:

```bash
oc --context=my-spoke get pods -n open-cluster-management-agent-addon
```

---

## Troubleshooting

### MultiClusterHub stuck in Installing phase

Check operator pod logs:

```bash
oc --context=my-hub logs -n open-cluster-management \
  -l name=multiclusterhub-operator --tail=50
```

### Spoke not joining

1. Verify the auto-import-secret was consumed (it gets deleted after use):

```bash
oc --context=my-hub get secret auto-import-secret -n my-spoke
```

If the secret still exists, the import controller may not have processed it
yet. Check for errors in the import controller logs:

```bash
oc --context=my-hub logs -n multicluster-engine \
  -l app=managedcluster-import-controller-v2 --tail=50
```

2. Verify the spoke cluster is reachable from the hub by checking the
   kubeconfig extracted in Step 2.3.

3. Check klusterlet status on the spoke:

```bash
oc --context=my-spoke get klusterlet
oc --context=my-spoke get pods -n open-cluster-management-agent
```

### Re-importing after a failed attempt

If a previous import failed and you need to retry, delete the stale secret
first:

```bash
oc --context=my-hub delete secret auto-import-secret -n my-spoke 2>/dev/null
oc --context=my-hub delete managedcluster my-spoke 2>/dev/null
```

Then repeat from Step 2.1.
