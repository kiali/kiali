{
  "mcpServers": {
    "openshift-lightspeed": {
      "command": "uv",
      "args": ["--directory", "/path/to/your/folder/ols-mcp", "run", "python", "-m", "ols_mcp.server"],
      "env": {
        "OLS_API_URL": "https://ols-route-openshift-lightspeed.apps.mycluster.example.com",
        "OLS_API_TOKEN": "sha256~NW5MJOynIEABEj_7pSna...",
        "OLS_TIMEOUT": "30.0",
        "OLS_VERIFY_SSL": "true"
      }
    }
  }
}


curl --insecure -X GET https://ols-route-openshift-lightspeed.apps.kiali.servicemesh.rhqeaws.com/liveness
{"alive":true}

curl --insecure -X GET https://ols-route-openshift-lightspeed.apps.kiali.servicemesh.rhqeaws.com/metrics -H "Authorization: Bearer sha256~8eh5JAUbX79fNlgzebR6dQ6j_rcat9ecDYHhT-0WiH0"

curl --insecure -X POST https://ols-route-openshift-lightspeed.apps.kiali.servicemesh.rhqeaws.com/authorized -H "Authorization: Bearer sha256~xVRjlDUaAPyU_ayYygYzovdB4kwF_KsyDbKeopZ1cFw"
{"user_id":"d4d87c31-5bd3-43b8-b28d-d113ca077bdf","username":"kube:admin","skip_user_id_check":false}


curl --insecure -X POST https://ols-route-openshift-lightspeed.apps.kiali.servicemesh.rhqeaws.com/authorized -H "Authorization: Bearer sha256~xVRjlDUaAPyU_ayYygYzovdB4kwF_KsyDbKeopZ1cFw" -d '{"user_id": "d4d87c31-5bd3-43b8-b28d-d113ca077bdf"}'




curl --insecure -X POST https://ols-route-openshift-lightspeed.apps.kiali.servicemesh.rhqeaws.com/v1/streaming_query -H "Content-Type: application/json" -d '{"media_type": "application/json", "query": "Hello"}' -H "Authorization: Bearer sha256~xVRjlDUaAPyU_ayYygYzovdB4kwF_KsyDbKeopZ1cFw"

curl --insecure -X POST https://ols-route-openshift-lightspeed.apps.kiali.servicemesh.rhqeaws.com/v1/query -H "Content-Type: application/json" -d '{"media_type": "application/json", "query": "Check services in my namespace bookinfo"}' -H "Authorization: Bearer sha256~q9GRhVZv13puk6wzzkgjcmbWYBW3sL_GTBvoMlJPnAs"

{"conversation_id":"ea7291c5-8224-4579-a63c-2e64bde196ac","response":"The following services are present in the `bookinfo` namespace:\n\n*   **reviews**\n*","referenced_documents":[{"doc_url":"https://docs.openshift.com/container-platform/4.21/service_mesh/v2x/ossm-create-mesh.html","doc_title":"Adding services to a service mesh"}],"truncated":false,"input_tokens":5507,"output_tokens":49,"available_quotas":{},"tool_calls":[{"name":"ossm_get_resource_details","args":{"namespaces":"bookinfo","resource_type":"service"},"id":"function-call-9568733829430823656","type":"tool_call"}],"tool_results":[{"id":"function-call-9568733829430823656","status":"success","content":"{\"cluster\":\"Kubernetes\",\"services\":[{\"name\":\"reviews\",\"namespace\":\"bookinfo\",\"istioSidecar\":true,\"cluster\":\"Kubernetes\",\"isAmbient\":false,\"appLabel\":true,\"additionalDetailSample\":null,\"annotations\":null,\"healthAnnotations\":{},\"ports\":null,\"labels\":{\"app\":\"reviews\",\"service\":\"reviews\"},\"selector\":{\"app\":\"reviews\"},\"istioReferences\":[],\"kialiWizard\":\"\",\"serviceRegistry\":\"Kubernetes\",\"health\":{\"requests\":{\"inbound\":{},\"outbound\":{},\"healthAnnotations\":{}}}},{\"name\":\"details\",\"namespace\":\"bookinfo\",\"istioSidecar\":true,\"cluster\":\"Kubernetes\",\"isAmbient\":false,\"appLabel\":true,\"additionalDetailSample\":null,\"annotations\":null,\"healthAnnotations\":{},\"ports\":null,\"labels\":{\"app\":\"details\",\"service\":\"details\"},\"selector\":{\"app\":\"details\"},\"istioReferences\":[],\"kialiWizard\":\"\",\"serviceRegistry\":\"Kubernetes\",\"health\":{\"requests\":{\"inbound\":{},\"outbound\":{},\"healthAnnotations\":{}}}},{\"name\":\"istio-ingressgateway\",\"namespace\":\"bookinfo\",\"istioSidecar\":true,\"cluster\":\"Kubernetes\",\"isAmbient\":false,\"appLabel\":false,\"additionalDetailSample\":null,\"annotations\":null,\"healthAnnotations\":{},\"ports\":null,\"labels\":null,\"selector\":{\"istio\":\"ingressgateway\"},\"istioReferences\":[],\"kialiWizard\":\"\",\"serviceRegistry\":\"Kubernetes\",\"health\":{\"requests\":{\"inbound\":{},\"outbound\":{},\"healthAnnotations\":{}}}},{\"name\":\"productpage\",\"namespace\":\"bookinfo\",\"istioSidecar\":true,\"cluster\":\"Kubernetes\",\"isAmbient\":false,\"appLabel\":true,\"additionalDetailSample\":null,\"annotations\":null,\"healthAnnotations\":{},\"ports\":null,\"labels\":{\"app\":\"productpage\",\"service\":\"productpage\"},\"selector\":{\"app\":\"productpage\"},\"istioReferences\":[{\"objectGVK\":{\"Group\":\"networking.istio.io\",\"Version\":\"v1\",\"Kind\":\"VirtualService\"},\"name\":\"bookinfo\",\"namespace\":\"bookinfo\",\"cluster\":\"\"},{\"objectGVK\":{\"Group\":\"networking.istio.io\",\"Version\":\"v1\",\"Kind\":\"Gateway\"},\"name\":\"bookinfo-gateway\",\"namespace\":\"bookinfo\",\"cluster\":\"\"}],\"kialiWizard\":\"\",\"serviceRegistry\":\"Kubernetes\",\"health\":{\"requests\":{\"inbound\":{},\"outbound\":{},\"healthAnnotations\":{}}}},{\"name\":\"ratings\",\"namespace\":\"bookinfo\",\"istioSidecar\":true,\"cluster\":\"Kubernetes\",\"isAmbient\":false,\"appLabel\":true,\"additionalDetailSample\":null,\"annotations\":null,\"healthAnnotations\":{},\"ports\":null,\"labels\":{\"app\":\"ratings\",\"service\":\"ratings\"},\"selector\":{\"app\":\"ratings\"},\"istioReferences\":[],\"kialiWizard\":\"\",\"serviceRegistry\":\"Kubernetes\",\"health\":{\"requests\":{\"inbound\":{},\"outbound\":{},\"healthAnnotations\":{}}}}],\"validations\":{\"service\":{\"details.bookinfo\":{\"name\":\"details\",\"namespace\":\"bookinfo\",\"cluster\":\"\",\"objectGVK\":{\"Group\":\"\",\"Version\":\"\",\"Kind\":\"service\"},\"valid\":true,\"checks\":[],\"references\":null},\"istio-ingressgateway.bookinfo\":{\"name\":\"istio-ingressgateway\",\"namespace\":\"bookinfo\",\"cluster\":\"\",\"objectGVK\":{\"Group\":\"\",\"Version\":\"\",\"Kind\":\"service\"},\"valid\":true,\"checks\":[],\"references\":null},\"productpage.bookinfo\":{\"name\":\"productpage\",\"namespace\":\"bookinfo\",\"cluster\":\"\",\"objectGVK\":{\"Group\":\"\",\"Version\":\"\",\"Kind\":\"service\"},\"valid\":true,\"checks\":[],\"references\":null},\"ratings.bookinfo\":{\"name\":\"ratings\",\"namespace\":\"bookinfo\",\"cluster\":\"\",\"objectGVK\":{\"Group\":\"\",\"Version\":\"\",\"Kind\":\"service\"},\"valid\":true,\"checks\":[],\"references\":null},\"reviews.bookinfo\":{\"name\":\"reviews\",\"namespace\":\"bookinfo\",\"cluster\":\"\",\"objectGVK\":{\"Group\":\"\",\"Version\":\"\",\"Kind\":\"service\"},\"valid\":true,\"checks\":[],\"references\":null}}}}","type":"tool_result","round":1}]}

data: {"event": "start", "data": {"conversation_id": "0c2c5ec8-6918-4d8d-bac5-2e67973f5887"}}

data: {"event": "token", "data": {"id": 0, "token": "Hello! I"}}

data: {"event": "token", "data": {"id": 1, "token": "'m OpenShift Lightspeed, your expert AI assistant for OpenShift and related"}}

data: {"event": "end", "data": {"referenced_documents": [], "truncated": false, "input_tokens": 682, "output_tokens": 29}, "available_quotas": {}}

curl --insecure -X POST https://ols-route-openshift-lightspeed.apps.kiali.servicemesh.rhqeaws.com/v1/streaming_query -H "Content-Type: application/json" -d '{"media_type": "application/json", "query": "Check my services in namespace bookinfo","conversation_id": "0c2c5ec8-6918-4d8d-bac5-2e67973f5887"}' -H "Authorization: Bearer sha256~xVRjlDUaAPyU_ayYygYzovdB4kwF_KsyDbKeopZ1cFw"

data: {"event": "start", "data": {"conversation_id": "0c2c5ec8-6918-4d8d-bac5-2e67973f5887"}}

data: {"event": "tool_call", "data": {"name": "ossm_get_resource_details", "args": {"resource_type": "service", "namespaces": "bookinfo"}, "id": "function-call-2794250137325187415", "type": "tool_call"}}

data: {"event": "tool_result", "data": {"id": "function-call-2794250137325187415", "status": "success", "content": "{\"cluster\":\"Kubernetes\",\"services\":[{\"name\":\"reviews\",\"namespace\":\"bookinfo\",\"istioSidecar\":true,\"cluster\":\"Kubernetes\",\"isAmbient\":false,\"appLabel\":true,\"additionalDetailSample\":null,\"annotations\":null,\"healthAnnotations\":{},\"ports\":null,\"labels\":{\"app\":\"reviews\",\"service\":\"reviews\"},\"selector\":{\"app\":\"reviews\"},\"istioReferences\":[],\"kialiWizard\":\"\",\"serviceRegistry\":\"Kubernetes\",\"health\":{\"requests\":{\"inbound\":{},\"outbound\":{},\"healthAnnotations\":{}}}},{\"name\":\"details\",\"namespace\":\"bookinfo\",\"istioSidecar\":true,\"cluster\":\"Kubernetes\",\"isAmbient\":false,\"appLabel\":true,\"additionalDetailSample\":null,\"annotations\":null,\"healthAnnotations\":{},\"ports\":null,\"labels\":{\"app\":\"details\",\"service\":\"details\"},\"selector\":{\"app\":\"details\"},\"istioReferences\":[],\"kialiWizard\":\"\",\"serviceRegistry\":\"Kubernetes\",\"health\":{\"requests\":{\"inbound\":{},\"outbound\":{},\"healthAnnotations\":{}}}},{\"name\":\"istio-ingressgateway\",\"namespace\":\"bookinfo\",\"istioSidecar\":true,\"cluster\":\"Kubernetes\",\"isAmbient\":false,\"appLabel\":false,\"additionalDetailSample\":null,\"annotations\":null,\"healthAnnotations\":{},\"ports\":null,\"labels\":null,\"selector\":{\"istio\":\"ingressgateway\"},\"istioReferences\":[],\"kialiWizard\":\"\",\"serviceRegistry\":\"Kubernetes\",\"health\":{\"requests\":{\"inbound\":{},\"outbound\":{},\"healthAnnotations\":{}}}},{\"name\":\"productpage\",\"namespace\":\"bookinfo\",\"istioSidecar\":true,\"cluster\":\"Kubernetes\",\"isAmbient\":false,\"appLabel\":true,\"additionalDetailSample\":null,\"annotations\":null,\"healthAnnotations\":{},\"ports\":null,\"labels\":{\"app\":\"productpage\",\"service\":\"productpage\"},\"selector\":{\"app\":\"productpage\"},\"istioReferences\":[{\"objectGVK\":{\"Group\":\"networking.istio.io\",\"Version\":\"v1\",\"Kind\":\"VirtualService\"},\"name\":\"bookinfo\",\"namespace\":\"bookinfo\",\"cluster\":\"\"},{\"objectGVK\":{\"Group\":\"networking.istio.io\",\"Version\":\"v1\",\"Kind\":\"Gateway\"},\"name\":\"bookinfo-gateway\",\"namespace\":\"bookinfo\",\"cluster\":\"\"}],\"kialiWizard\":\"\",\"serviceRegistry\":\"Kubernetes\",\"health\":{\"requests\":{\"inbound\":{},\"outbound\":{},\"healthAnnotations\":{}}}},{\"name\":\"ratings\",\"namespace\":\"bookinfo\",\"istioSidecar\":true,\"cluster\":\"Kubernetes\",\"isAmbient\":false,\"appLabel\":true,\"additionalDetailSample\":null,\"annotations\":null,\"healthAnnotations\":{},\"ports\":null,\"labels\":{\"app\":\"ratings\",\"service\":\"ratings\"},\"selector\":{\"app\":\"ratings\"},\"istioReferences\":[],\"kialiWizard\":\"\",\"serviceRegistry\":\"Kubernetes\",\"health\":{\"requests\":{\"inbound\":{},\"outbound\":{},\"healthAnnotations\":{}}}}],\"validations\":{\"service\":{\"details.bookinfo\":{\"name\":\"details\",\"namespace\":\"bookinfo\",\"cluster\":\"\",\"objectGVK\":{\"Group\":\"\",\"Version\":\"\",\"Kind\":\"service\"},\"valid\":true,\"checks\":[],\"references\":null},\"istio-ingressgateway.bookinfo\":{\"name\":\"istio-ingressgateway\",\"namespace\":\"bookinfo\",\"cluster\":\"\",\"objectGVK\":{\"Group\":\"\",\"Version\":\"\",\"Kind\":\"service\"},\"valid\":true,\"checks\":[],\"references\":null},\"productpage.bookinfo\":{\"name\":\"productpage\",\"namespace\":\"bookinfo\",\"cluster\":\"\",\"objectGVK\":{\"Group\":\"\",\"Version\":\"\",\"Kind\":\"service\"},\"valid\":true,\"checks\":[],\"references\":null},\"ratings.bookinfo\":{\"name\":\"ratings\",\"namespace\":\"bookinfo\",\"cluster\":\"\",\"objectGVK\":{\"Group\":\"\",\"Version\":\"\",\"Kind\":\"service\"},\"valid\":true,\"checks\":[],\"references\":null},\"reviews.bookinfo\":{\"name\":\"reviews\",\"namespace\":\"bookinfo\",\"cluster\":\"\",\"objectGVK\":{\"Group\":\"\",\"Version\":\"\",\"Kind\":\"service\"},\"valid\":true,\"checks\":[],\"references\":null}}}}", "type": "tool_result", "round": 1}}

data: {"event": "token", "data": {"id": 0, "token": "In"}}

data: {"event": "token", "data": {"id": 1, "token": " the `bookinfo` namespace, the following services are deployed:\n\n*   "}}

data: {"event": "token", "data": {"id": 2, "token": "**reviews**: This service has the labels `app: reviews` and `service: reviews`.\n*   **details**: This service has the labels `app: details` and `service: details`.\n*   **istio-"}}

data: {"event": "token", "data": {"id": 3, "token": "ingressgateway**: This service has the selector `istio: ingressgateway`.\n*   **productpage**: This service has the labels `app: productpage` and `service: productpage`. It also has Istio references to a"}}

data: {"event": "token", "data": {"id": 4, "token": " `VirtualService` named `bookinfo` and a `Gateway` named `bookinfo-gateway`.\n*   **ratings**: This service has the labels `app: ratings` and `service: ratings`.\n\nAll these services have an"}}

data: {"event": "end", "data": {"referenced_documents": [{"doc_title": "Adding services to a service mesh", "doc_url": "https://docs.openshift.com/container-platform/4.21/service_mesh/v2x/ossm-create-mesh.html"}], "truncated": false, "input_tokens": 5581, "output_tokens": 167}, "available_quotas": {}}




/v1/conversations

curl --insecure -X GET https://ols-route-openshift-lightspeed.apps.kiali.servicemesh.rhqeaws.com/v1/conversations -H "Content-Type: application/json"  -H "Authorization: Bearer sha256~xVRjlDUaAPyU_ayYygYzovdB4kwF_KsyDbKeopZ1cFw"


{"conversations":[{"conversation_id":"0c2c5ec8-6918-4d8d-bac5-2e67973f5887","topic_summary":"","last_message_timestamp":1770811379.0034,"message_count":2},{"conversation_id":"b594b580-1470-48d5-8ba5-6669ef4f0c9c","topic_summary":"","last_message_timestamp":1770807026.382024,"message_count":9}]}