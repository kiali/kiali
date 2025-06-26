#!/bin/bash

##############################################################################
# deploy-kiali.sh
#
# Installs Kiali in both clusters.
#
##############################################################################

SCRIPT_DIR="$(cd $(dirname "${BASH_SOURCE[0]}") && pwd)"
source ${SCRIPT_DIR}/env.sh $*

KIALI_REPO_ROOT="${SCRIPT_DIR}/../../../"

set -euo pipefail

if [ "${KIALI_ENABLED}" != "true" ]; then
  echo "Will not install kiali"
  return 0
else
  if [ "${SINGLE_KIALI}" == "true" ]; then
    echo "Installing Kiali in a single cluster."
  else
    echo "Installing Kiali in the two clusters"
  fi
fi

if ! which helm; then
  echo "You do not have helm in your PATH - will not install Kiali"
  return 1
fi

deploy_kiali() {
  local helm_args=()
  #Enable tracing
  helm_args+=(--set external_services.tracing.enabled="true")

  if [ "${IS_OPENSHIFT}" == "true" ]; then
    helm_args+=("--disable-openapi-validation")
    if [ "${KIALI_USE_DEV_IMAGE}" == "true" ]; then
      echo "'--kiali-use-dev-image true' is not supported with Openshift today - will not install Kiali"
      return 1
    fi
  fi

  local cluster_name="${1}"
  local web_fqdn="${2}"
  local web_schema="${3}"
  [ -n "${web_fqdn}" ] && helm_args+=("--set server.web_fqdn=${web_fqdn}")
  [ -n "${web_schema}" ] && helm_args+=("--set server.web_schema=${web_schema}")

  if [ "${KIALI_AUTH_STRATEGY}" == "anonymous" ]; then
    helm_args+=(--set auth.strategy="anonymous")
  elif [ "${KIALI_AUTH_STRATEGY}" == "openid" ]; then
    # These need to exist prior to installing Kiali.
    # Create secret with the oidc secret
    ${CLIENT_EXE} create configmap kiali-cabundle --from-file="openid-server-ca.crt=${KEYCLOAK_CERTS_DIR}/root-ca.pem" -n "${ISTIO_NAMESPACE}"
    ${CLIENT_EXE} create secret generic kiali --from-literal="oidc-secret=kube-client-secret" -n istio-system
    if [ "${AUTH_GROUPS}" != "" ]; then
      old_IFS=$IFS
      IFS=','
      read -ra GROUP_LIST <<< "${AUTH_GROUPS}"
      for group in "${GROUP_LIST[@]}"; do
        ${CLIENT_EXE} create clusterrolebinding kiali-group-viewer --clusterrole=kiali-viewer --group=oidc:"$group"
      done
      IFS=$old_IFS
    else
      ${CLIENT_EXE} create clusterrolebinding kiali-user-viewer --clusterrole=kiali-viewer --user=oidc:kiali
    fi

    helm_args+=(
      --set auth.strategy="openid"
      --set auth.openid.client_id="kube"
      --set-string auth.openid.issuer_uri="https://${KEYCLOAK_ADDRESS}/realms/kube"
      --set auth.openid.insecure_skip_verify_tls="false"
      --set auth.openid.username_claim="preferred_username"
    )
  elif [ "${KIALI_AUTH_STRATEGY}" == "openshift" ]; then
    helm_args+=(
      --set auth.strategy="openshift"
    )
  else
    echo "Kiali auth strategy [${KIALI_AUTH_STRATEGY}] is not supported for multi-cluster - will not install Kiali"
    return 1
  fi

  if [ "${KIALI_USE_DEV_IMAGE}" == "true" ]; then
    if [ "${KIALI_BUILD_DEV_IMAGE}" == "true" ]; then
      echo "Building the dev image..."
      make -e -C "${KIALI_REPO_ROOT}" build-ui build
    fi

    if [ "${MANAGE_KIND}" == "true" ]; then
      echo "Pushing the images into the cluster..."
      make -e -C "${KIALI_REPO_ROOT}" DORP="${DORP}" CLUSTER_TYPE="kind" KIND_NAME="${cluster_name}" cluster-push-kiali
      helm_args+=(
        --set deployment.image_pull_policy="Never"
        --set deployment.image_name="localhost/kiali/kiali"
        --set deployment.image_version="dev"
      )
    elif [ "${KIALI_AUTH_STRATEGY}" == "openshift" ]; then
      echo "Pushing the images into the cluster..."
      make -e -C "${KIALI_REPO_ROOT}" DORP="${DORP}" CLUSTER_TYPE="openshift" cluster-status
      local image_name
      podman login --tls-verify=false -u "$(oc whoami | tr -d ':')" -p "$(oc whoami -t)" "$(oc get image.config.openshift.io/cluster -o custom-columns=EXT:.status.externalRegistryHostnames[0] --no-headers 2>/dev/null)"
      image_name="$(oc get image.config.openshift.io/cluster -o custom-columns=INT:.status.internalRegistryHostname --no-headers 2>/dev/null)/kiali/kiali"
      make -e -C "${KIALI_REPO_ROOT}" DORP="${DORP}" CLUSTER_TYPE="openshift" cluster-push-kiali
      helm_args+=(
        --set deployment.image_pull_policy="Always"
        --set deployment.image_name="${image_name}"
        --set deployment.image_version="dev"
      )
    else
      local image_to_tag="quay.io/kiali/kiali:dev"
      local image_to_push="$(minikube -p ${cluster_name} ip):5000/kiali/kiali:dev"
      echo "Tagging the dev image [${image_to_tag}] -> [${image_to_push}]..."
      ${DORP} tag ${image_to_tag} ${image_to_push}
      echo "Pushing the dev image [${image_to_push}] to the cluster [${cluster_name}]..."
      ${DORP} push --tls-verify=false ${image_to_push}
      helm_args+=(
        --set deployment.image_name="localhost:5000/kiali/kiali"
        --set deployment.image_version="dev"
      )
    fi
  fi


  if [ "${KIALI_CREATE_REMOTE_CLUSTER_SECRETS}" == "true" ]; then
    local openshift_flags=""
    if [ "${KIALI_AUTH_STRATEGY}" == "openshift" ]; then
      openshift_flags="--allow-skip-tls-verify true --kiali-resource-name kiali"
    fi
    if [ "${SINGLE_KIALI}" == "true" ]; then
      local remote_url_flag=""
      if [ "${MANAGE_KIND}" == "true" ]; then
        remote_url_flag="--remote-cluster-url https://$(${CLIENT_EXE} get nodes ${CLUSTER2_NAME}-control-plane --context ${CLUSTER2_CONTEXT} -o jsonpath='{.status.addresses[?(@.type == "InternalIP")].address}'):6443"
      fi
      echo "Preparing remote cluster secret for single Kiali install in multicluster or external mode."
      ${SCRIPT_DIR}/kiali-prepare-remote-cluster.sh -c ${CLIENT_EXE} --remote-cluster-name ${CLUSTER2_NAME} -kcc ${CLUSTER1_CONTEXT} -rcc ${CLUSTER2_CONTEXT} ${remote_url_flag} -vo false ${openshift_flags} -rcns ${ISTIO_NAMESPACE}
    else
      echo "Preparing remote cluster secrets for both Kiali installs."
      local remote_url_flag1=""
      local remote_url_flag2=""
      if [ "${MANAGE_KIND}" == "true" ]; then
        remote_url_flag1="--remote-cluster-url https://$(${CLIENT_EXE} get nodes ${CLUSTER2_NAME}-control-plane --context ${CLUSTER2_CONTEXT} -o jsonpath='{.status.addresses[?(@.type == "InternalIP")].address}'):6443"
        remote_url_flag2="--remote-cluster-url https://$(${CLIENT_EXE} get nodes ${CLUSTER1_NAME}-control-plane --context ${CLUSTER1_CONTEXT} -o jsonpath='{.status.addresses[?(@.type == "InternalIP")].address}'):6443"
      fi
      ${SCRIPT_DIR}/kiali-prepare-remote-cluster.sh -c ${CLIENT_EXE} --remote-cluster-name ${CLUSTER2_NAME} -kcc ${CLUSTER1_CONTEXT} -rcc ${CLUSTER2_CONTEXT} ${remote_url_flag1} -vo false ${openshift_flags}
      ${SCRIPT_DIR}/kiali-prepare-remote-cluster.sh -c ${CLIENT_EXE} --remote-cluster-name ${CLUSTER1_NAME} -kcc ${CLUSTER2_CONTEXT} -rcc ${CLUSTER1_CONTEXT} ${remote_url_flag2} -vo false ${openshift_flags}
    fi
  fi

  local service_type="LoadBalancer"
  local ingress_enabled="false"
  local web_port="80"
  if [ "${KIALI_AUTH_STRATEGY}" == "openshift" ]; then
    service_type="ClusterIP"
    ingress_enabled="true"
    web_port=""
  
    local kiali_route_url
    kiali_route_url="https://kiali-${ISTIO_NAMESPACE}.$(kubectl get ingresses.config/cluster -o jsonpath='{.spec.domain}')"
    helm_args+=(--set kiali_route_url="${kiali_route_url}")
  fi

  if [ "${TEMPO}" == "true" ]; then
    helm_args+=(
          --set external_services.tracing.external_url="http://tempo-cr-query-frontend.tempo:3200"
          --set external_services.tracing.provider="tempo"
          --set external_services.tracing.internal_url="http://tempo-cr-query-frontend.tempo:3200"
          --set external_services.tracing.use_grpc="false"
        )
  else
    helm_args+=(
          --set external_services.tracing.external_url="http://tracing.istio-system/jaeger"
        )
  fi

  if [ "${CI_CONFIG}" == "true" ]; then
    helm_args+=(
          --set external_services.grafana.external_url="http://grafana.istio-system:3000"
          --set external_services.grafana.dashboards[0].name="Istio Mesh Dashboard"
          --set external_services.istio.validation_reconcile_interval="5s"
          --set health_config.rate[0].kind="service"
          --set health_config.rate[0].name="y-server"
          --set health_config.rate[0].namespace="alpha"
          --set health_config.rate[0].tolerance[0].code="5xx"
          --set health_config.rate[0].tolerance[0].degraded="2"
          --set health_config.rate[0].tolerance[0].failure="100"
          --set kiali_internal.cache_expiration.gateway="2m"
          --set kiali_internal.cache_expiration.istio_status="0"
          --set kiali_internal.cache_expiration.mesh="10s"
          --set kiali_internal.cache_expiration.waypoint="2m"
        )
  fi

  if [ "${IGNORE_LOCAL_CLUSTER}" == "true" ]; then
    helm_args+=(
          --set clustering.ignore_local_cluster="true"
        )
  fi

  helm upgrade --install \
    "${helm_args[@]}" \
    --namespace "${ISTIO_NAMESPACE}" \
    --set deployment.logger.log_level="trace" \
    --set deployment.ingress.enabled="${ingress_enabled}" \
    --set deployment.service_type="${service_type}" \
    --set server.web_port="${web_port}" \
    kiali-server \
    "${KIALI_SERVER_HELM_CHARTS}"

  if [ "${KIALI_AUTH_STRATEGY}" == "openshift" ]; then
    local kiali_route_url
    kiali_route_url=$(kubectl get route kiali -n "${ISTIO_NAMESPACE}" -o jsonpath='{.spec.host}')
    ${CLIENT_EXE} get oauthclients --context "${CLUSTER1_CONTEXT}" -n "${ISTIO_NAMESPACE}" kiali-"${ISTIO_NAMESPACE}" -o json | jq ".redirectURIs = [\"https://${kiali_route_url}/api/auth/callback/${CLUSTER2_CONTEXT}\"]" | ${CLIENT_EXE} --force=true --context "${CLUSTER2_CONTEXT}" apply -f -
  else
  # Helm chart doesn't support passing in service opts so patch them after the helm deploy.
    kubectl patch service kiali -n "${ISTIO_NAMESPACE}" --type=json -p='[{"op": "replace", "path": "/spec/ports/0/port", "value":80}]'
    kubectl wait --for=jsonpath='{.status.loadBalancer.ingress}' -n istio-system service/kiali
  fi

  # If using openid auth strategy, create the keycloak realm and the kiali user.

  if [ "${KIALI_AUTH_STRATEGY}" == "openid" ]; then
    echo "## Kiali auth strategy is openid; get a token from keycloak at [${KEYCLOAK_ADDRESS}] to use the admin api"
    TOKEN_KEY=$(curl -k -X POST https://"${KEYCLOAK_ADDRESS}"/realms/master/protocol/openid-connect/token \
                -d grant_type=password \
                -d client_id=admin-cli \
                -d username=admin \
                -d password=admin \
                -d scope=openid \
                -d response_type=id_token | jq -r '.access_token')

    # Replace the redirect URI with the minikube ip. Create the realm.
    local KIALI_SVC_LB_IP
    KIALI_SVC_LB_IP=$(kubectl get svc kiali -o=jsonpath='{.status.loadBalancer.ingress[0].ip}' -n istio-system)

    jq ".clients[] |= if .clientId == \"kube\" then .redirectUris = [\"http://${KIALI_SVC_LB_IP}/kiali/*\"] else . end" < "${SCRIPT_DIR}"/realm-export-template.json | curl -k -L https://"${KEYCLOAK_ADDRESS}"/admin/realms -H "Authorization: Bearer $TOKEN_KEY" -H "Content-Type: application/json" -X POST -d @-

    # Create the kiali user
    if [ "${AUTH_GROUPS}" != "" ]; then
      quoted_groups="\"${AUTH_GROUPS//,/'","'}\""
      json_string='{"username": "kiali", "enabled": true, "credentials": [{"type": "password", "value": "kiali"}], "groups": ['"${quoted_groups}"']}'
      curl -k -L https://"${KEYCLOAK_ADDRESS}"/admin/realms/kube/users -H "Authorization: Bearer $TOKEN_KEY" -d "$json_string" -H 'Content-Type: application/json'
    else
      curl -k -L https://"${KEYCLOAK_ADDRESS}"/admin/realms/kube/users -H "Authorization: Bearer $TOKEN_KEY" -d '{"username": "kiali", "enabled": true, "credentials": [{"type": "password", "value": "kiali"}]}' -H 'Content-Type: application/json'
      curl -k -L https://"${KEYCLOAK_ADDRESS}"/admin/realms/kube/users -H "Authorization: Bearer $TOKEN_KEY" -d '{"username": "bookinfouser", "enabled": true, "credentials": [{"type": "password", "value": "kiali"}]}' -H 'Content-Type: application/json'
    fi

    if [ "${SINGLE_CLUSTER}" != "true" ]; then
      # Create a clusterrole and clusterrolebinding so that the kiali oidc user can view and edit resources in kiali.
      # It needs read-write permissions for the tests to create and delete resources so we have to do
      # this helm templating to create the role with write permissions since only when you are using
      # anonymous auth do you get a role with write permissions. For testing we want a role that does
      # potentially all the things kiali can do so that's why we reuse the kiali role rather than
      # having to maintain a whole separate role just for the testing user.
      helm template --show-only "templates/role.yaml" --set deployment.instance_name=kiali-testing-user --set auth.strategy=anonymous kiali-server "${KIALI_SERVER_HELM_CHARTS}" | kubectl apply --context "${CLUSTER1_CONTEXT}" -f -
      helm template --show-only "templates/role.yaml" --set deployment.instance_name=kiali-testing-user --set auth.strategy=anonymous kiali-server "${KIALI_SERVER_HELM_CHARTS}" | kubectl apply --context "${CLUSTER2_CONTEXT}" -f -

      kubectl apply --context "${CLUSTER1_CONTEXT}" -f - <<EOF
apiVersion: rbac.authorization.k8s.io/v1
kind: ClusterRoleBinding
metadata:
  name: kiali-testing-user
roleRef:
  apiGroup: rbac.authorization.k8s.io
  kind: ClusterRole
  name: kiali-testing-user
subjects:
- apiGroup: rbac.authorization.k8s.io
  kind: User
  name: oidc:kiali
EOF

      # Create a clusterrolebinding in the west cluster so that the kiali oidc user can view resources in kiali.
      kubectl apply --context "${CLUSTER2_CONTEXT}" -f - <<EOF
apiVersion: rbac.authorization.k8s.io/v1
kind: ClusterRoleBinding
metadata:
  name: kiali-testing-user
roleRef:
  apiGroup: rbac.authorization.k8s.io
  kind: ClusterRole
  name: kiali-testing-user
subjects:
- apiGroup: rbac.authorization.k8s.io
  kind: User
  name: oidc:kiali
EOF

      # Role to access bookinfo
      kubectl apply --context "${CLUSTER1_CONTEXT}" -f ${SCRIPT_DIR}/roleBookinfo.yaml

      # Create a rolebinding
      kubectl apply --context "${CLUSTER1_CONTEXT}" -f - <<EOF
apiVersion: rbac.authorization.k8s.io/v1
kind: RoleBinding
metadata:
 name: kiali-bookinfo
 namespace: bookinfo
roleRef:
 apiGroup: rbac.authorization.k8s.io
 kind: Role
 name: kiali-bookinfo
subjects:
- kind: User
  name: oidc:bookinfouser
EOF

    fi

  fi
}


echo "==== DEPLOY KIALI TO CLUSTER #1 [${CLUSTER1_NAME}] - ${CLUSTER1_CONTEXT} (keycloak is at ${CLUSTER1_NAME})"
switch_cluster "${CLUSTER1_CONTEXT}" "${CLUSTER1_USER}" "${CLUSTER1_PASS}"
deploy_kiali "${CLUSTER1_NAME}" "${KIALI1_WEB_FQDN}" "${KIALI1_WEB_SCHEMA}"

if [ "${SINGLE_KIALI}" != "true" ]
then
  echo "==== DEPLOY KIALI TO CLUSTER #2 [${CLUSTER2_NAME}] - ${CLUSTER2_CONTEXT} (keycloak is at ${CLUSTER1_NAME})"
  switch_cluster "${CLUSTER2_CONTEXT}" "${CLUSTER2_USER}" "${CLUSTER2_PASS}"
  deploy_kiali "${CLUSTER2_NAME}" "${KIALI2_WEB_FQDN}" "${KIALI2_WEB_SCHEMA}"
fi
