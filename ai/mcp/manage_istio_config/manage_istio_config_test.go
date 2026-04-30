package manage_istio_config

import (
	"encoding/json"
	"fmt"
	"net/http"
	"net/http/httptest"
	"os"
	"testing"
	"time"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
	istio_api_v1alpha3 "istio.io/api/networking/v1alpha3"
	networking_v1 "istio.io/client-go/pkg/apis/networking/v1"
	api_errors "k8s.io/apimachinery/pkg/api/errors"
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
	"k8s.io/apimachinery/pkg/runtime"
	"k8s.io/apimachinery/pkg/runtime/schema"

	"github.com/kiali/kiali/ai/mcp/get_action_ui"
	"github.com/kiali/kiali/ai/mcputil"
	"github.com/kiali/kiali/business"
	"github.com/kiali/kiali/config"
	"github.com/kiali/kiali/kubernetes"
	"github.com/kiali/kiali/kubernetes/kubetest"
)

func TestMain(m *testing.M) {
	// The fake Istio clientset and the fake kubeCache are separate stores,
	// so the cache-wait polls always time out (5s each, 9 tests = 45s).
	// Shortcutting the timeout keeps the tests fast.
	kubernetes.CacheWaitTimeout = 1 * time.Millisecond
	os.Exit(m.Run())
}

// ---------------------------------------------------------------------------
// helpers
// ---------------------------------------------------------------------------

func setupTest(t *testing.T, objs ...runtime.Object) (*business.Layer, *config.Config) {
	t.Helper()
	conf := config.NewConfig()
	conf.KubernetesConfig.ClusterName = "east"
	config.Set(conf)

	runtimeObjs := make([]runtime.Object, 0, len(objs)+1)
	runtimeObjs = append(runtimeObjs, kubetest.FakeNamespace("bookinfo"))
	runtimeObjs = append(runtimeObjs, objs...)
	k8s := kubetest.NewFakeK8sClient(runtimeObjs...)
	return business.NewLayerBuilder(t, conf).WithClient(k8s).Build(), conf
}

func reqWithAuth() *http.Request {
	r := httptest.NewRequest("POST", "http://kiali/api/ai/mcp/manage_istio_config", nil)
	r.Header.Set("Kiali-User", "test-user")
	return r
}

func kialiIntf(r *http.Request, businessLayer *business.Layer, conf *config.Config) *mcputil.KialiInterface {
	return &mcputil.KialiInterface{
		Request:       r,
		BusinessLayer: businessLayer,
		Conf:          conf,
	}
}

func existingVS() *networking_v1.VirtualService {
	return &networking_v1.VirtualService{
		ObjectMeta: metav1.ObjectMeta{
			Name:      "reviews",
			Namespace: "bookinfo",
		},
		Spec: istio_api_v1alpha3.VirtualService{
			Hosts: []string{"reviews"},
		},
	}
}

func existingDR() *networking_v1.DestinationRule {
	return &networking_v1.DestinationRule{
		ObjectMeta: metav1.ObjectMeta{
			Name:      "reviews-dr",
			Namespace: "bookinfo",
		},
		Spec: istio_api_v1alpha3.DestinationRule{
			Host: "reviews",
		},
	}
}

func baseWriteArgs(action string) map[string]interface{} {
	return map[string]interface{}{
		"action":    action,
		"confirmed": true,
		"namespace": "bookinfo",
		"group":     "networking.istio.io",
		"version":   "v1",
		"kind":      "VirtualService",
		"object":    "reviews",
	}
}

// previewResponse is the shape returned when confirmed=false or for write actions with actions payload.
type previewResponse struct {
	Actions []get_action_ui.Action `json:"actions"`
	Result  interface{}            `json:"result"`
}

// ---------------------------------------------------------------------------
// 1. Schema / input validation tests
// ---------------------------------------------------------------------------

func TestValidateIstioConfigInput(t *testing.T) {
	tests := []struct {
		name    string
		args    map[string]interface{}
		wantErr string
	}{
		{
			name:    "invalid action",
			args:    map[string]interface{}{"action": "invalid"},
			wantErr: "invalid action",
		},
		{
			name:    "create missing namespace",
			args:    map[string]interface{}{"action": "create", "group": "networking.istio.io", "version": "v1", "kind": "VirtualService", "object": "x", "data": "{}"},
			wantErr: "namespace is required",
		},
		{
			name:    "create missing group",
			args:    map[string]interface{}{"action": "create", "namespace": "bookinfo", "version": "v1", "kind": "VirtualService", "object": "x", "data": "{}"},
			wantErr: "group is required",
		},
		{
			name:    "create missing version",
			args:    map[string]interface{}{"action": "create", "namespace": "bookinfo", "group": "networking.istio.io", "kind": "VirtualService", "object": "x", "data": "{}"},
			wantErr: "version is required",
		},
		{
			name:    "create missing kind",
			args:    map[string]interface{}{"action": "create", "namespace": "bookinfo", "group": "networking.istio.io", "version": "v1", "object": "x", "data": "{}"},
			wantErr: "kind is required",
		},
		{
			name:    "create missing data",
			args:    map[string]interface{}{"action": "create", "namespace": "bookinfo", "group": "networking.istio.io", "version": "v1", "kind": "VirtualService", "object": "x"},
			wantErr: "data is required",
		},
		{
			name:    "create missing object",
			args:    map[string]interface{}{"action": "create", "namespace": "bookinfo", "group": "networking.istio.io", "version": "v1", "kind": "VirtualService", "data": "{}"},
			wantErr: "object (resource name) is required",
		},
		{
			name:    "patch missing object",
			args:    map[string]interface{}{"action": "patch", "namespace": "bookinfo", "group": "networking.istio.io", "version": "v1", "kind": "VirtualService", "data": "{}"},
			wantErr: "object (resource name) is required",
		},
		{
			name:    "patch missing data",
			args:    map[string]interface{}{"action": "patch", "namespace": "bookinfo", "group": "networking.istio.io", "version": "v1", "kind": "VirtualService", "object": "x"},
			wantErr: "data is required",
		},
		{
			name:    "delete missing object",
			args:    map[string]interface{}{"action": "delete", "namespace": "bookinfo", "group": "networking.istio.io", "version": "v1", "kind": "VirtualService"},
			wantErr: "object (resource name) is required",
		},
		{
			name: "valid create",
			args: map[string]interface{}{"action": "create", "namespace": "bookinfo", "group": "networking.istio.io", "version": "v1", "kind": "VirtualService", "object": "x", "data": "{}"},
		},
		{
			name: "valid patch",
			args: map[string]interface{}{"action": "patch", "namespace": "bookinfo", "group": "networking.istio.io", "version": "v1", "kind": "VirtualService", "object": "x", "data": "{}"},
		},
		{
			name: "valid delete",
			args: map[string]interface{}{"action": "delete", "namespace": "bookinfo", "group": "networking.istio.io", "version": "v1", "kind": "VirtualService", "object": "x"},
		},
		{
			name:    "create invalid kind for networking",
			args:    map[string]interface{}{"action": "create", "namespace": "bookinfo", "group": "networking.istio.io", "version": "v1", "kind": "WasmPlugin", "object": "x", "data": "{}"},
			wantErr: "invalid kind",
		},
		{
			name:    "patch invalid kind for security",
			args:    map[string]interface{}{"action": "patch", "namespace": "bookinfo", "group": "security.istio.io", "version": "v1", "kind": "VirtualService", "object": "x", "data": "{}"},
			wantErr: "invalid kind",
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			err := validateIstioConfigInput(tt.args)
			if tt.wantErr != "" {
				require.Error(t, err)
				assert.Contains(t, err.Error(), tt.wantErr)
			} else {
				assert.NoError(t, err)
			}
		})
	}
}

func TestValidateReadOnlyIstioConfigInput(t *testing.T) {
	tests := []struct {
		name    string
		args    map[string]interface{}
		wantErr string
	}{
		{
			name: "list with no args is valid",
			args: map[string]interface{}{"action": "list"},
		},
		{
			name:    "get missing namespace",
			args:    map[string]interface{}{"action": "get", "group": "networking.istio.io", "version": "v1", "kind": "VirtualService", "object": "x"},
			wantErr: "namespace is required",
		},
		{
			name:    "get missing group",
			args:    map[string]interface{}{"action": "get", "namespace": "bookinfo", "version": "v1", "kind": "VirtualService", "object": "x"},
			wantErr: "group is required",
		},
		{
			name:    "get missing version",
			args:    map[string]interface{}{"action": "get", "namespace": "bookinfo", "group": "networking.istio.io", "kind": "VirtualService", "object": "x"},
			wantErr: "version is required",
		},
		{
			name:    "get missing kind",
			args:    map[string]interface{}{"action": "get", "namespace": "bookinfo", "group": "networking.istio.io", "version": "v1", "object": "x"},
			wantErr: "kind is required",
		},
		{
			name:    "get missing object",
			args:    map[string]interface{}{"action": "get", "namespace": "bookinfo", "group": "networking.istio.io", "version": "v1", "kind": "VirtualService"},
			wantErr: "name is required",
		},
		{
			name:    "invalid action for read-only",
			args:    map[string]interface{}{"action": "create"},
			wantErr: "invalid action",
		},
		{
			name: "valid get",
			args: map[string]interface{}{"action": "get", "namespace": "bookinfo", "group": "networking.istio.io", "version": "v1", "kind": "VirtualService", "object": "x"},
		},
		{
			name:    "get invalid kind for networking",
			args:    map[string]interface{}{"action": "get", "namespace": "bookinfo", "group": "networking.istio.io", "version": "v1", "kind": "WasmPlugin", "object": "x"},
			wantErr: "invalid kind",
		},
		{
			name:    "list filter kind without group",
			args:    map[string]interface{}{"action": "list", "kind": "VirtualService"},
			wantErr: "group is required",
		},
		{
			name:    "list filter group without kind",
			args:    map[string]interface{}{"action": "list", "group": "networking.istio.io"},
			wantErr: "kind is required",
		},
		{
			name:    "list filter invalid group",
			args:    map[string]interface{}{"action": "list", "group": "gateway.networking.k8s.io", "kind": "Gateway"},
			wantErr: "invalid group",
		},
		{
			name:    "list filter invalid kind for networking",
			args:    map[string]interface{}{"action": "list", "group": "networking.istio.io", "kind": "WasmPlugin"},
			wantErr: "invalid kind",
		},
		{
			name: "list filter valid networking",
			args: map[string]interface{}{"action": "list", "group": "networking.istio.io", "kind": "Sidecar"},
		},
		{
			name: "list filter valid security",
			args: map[string]interface{}{"action": "list", "group": "security.istio.io", "kind": "PeerAuthentication"},
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			err := validateReadOnlyIstioConfigInput(tt.args)
			if tt.wantErr != "" {
				require.Error(t, err)
				assert.Contains(t, err.Error(), tt.wantErr)
			} else {
				assert.NoError(t, err)
			}
		})
	}
}

func TestValidateManagedIstioGroupAndKind(t *testing.T) {
	networkingAllowed := []string{
		"VirtualService", "DestinationRule", "Gateway", "ServiceEntry", "Sidecar",
		"WorkloadEntry", "WorkloadGroup", "EnvoyFilter",
	}
	securityAllowed := []string{"AuthorizationPolicy", "PeerAuthentication", "RequestAuthentication"}

	tests := []struct {
		name    string
		group   string
		kind    string
		wantErr string
	}{
		{
			name:    "empty group",
			group:   "",
			kind:    "VirtualService",
			wantErr: "group is required",
		},
		{
			name:    "empty kind",
			group:   "networking.istio.io",
			kind:    "",
			wantErr: "kind is required",
		},
		{
			name:    "unknown group",
			group:   "telemetry.istio.io",
			kind:    "Telemetry",
			wantErr: "invalid group",
		},
		{
			name:    "networking disallowed kind",
			group:   "networking.istio.io",
			kind:    "WasmPlugin",
			wantErr: "invalid kind",
		},
		{
			name:    "security kind used with networking group",
			group:   "networking.istio.io",
			kind:    "AuthorizationPolicy",
			wantErr: "invalid kind",
		},
		{
			name:    "networking kind used with security group",
			group:   "security.istio.io",
			kind:    "VirtualService",
			wantErr: "invalid kind",
		},
		{
			name:    "security disallowed kind",
			group:   "security.istio.io",
			kind:    "WasmPlugin",
			wantErr: "invalid kind",
		},
		{
			name:    "whitespace trimmed networking Gateway",
			group:   "  networking.istio.io  ",
			kind:    " Gateway ",
			wantErr: "",
		},
	}

	for _, k := range networkingAllowed {
		tests = append(tests, struct {
			name    string
			group   string
			kind    string
			wantErr string
		}{name: "networking allowed " + k, group: "networking.istio.io", kind: k})
	}
	for _, k := range securityAllowed {
		tests = append(tests, struct {
			name    string
			group   string
			kind    string
			wantErr string
		}{name: "security allowed " + k, group: "security.istio.io", kind: k})
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			err := validateManagedIstioGroupAndKind(tt.group, tt.kind)
			if tt.wantErr != "" {
				require.Error(t, err)
				assert.Contains(t, err.Error(), tt.wantErr)
			} else {
				assert.NoError(t, err)
			}
		})
	}
}

// ---------------------------------------------------------------------------
// 2. Execute – write actions (create, patch, delete)
// ---------------------------------------------------------------------------

func TestExecute_CreateConfirmed(t *testing.T) {
	businessLayer, conf := setupTest(t)
	r := reqWithAuth()

	args := baseWriteArgs("create")
	args["data"] = `{"metadata":{"name":"reviews","namespace":"bookinfo"},"spec":{"hosts":["reviews"]}}`

	res, status := Execute(kialiIntf(r, businessLayer, conf), args)
	require.Equal(t, http.StatusOK, status)

	b, err := json.Marshal(res)
	require.NoError(t, err)
	var resp previewResponse
	require.NoError(t, json.Unmarshal(b, &resp))

	require.Len(t, resp.Actions, 1, "should include preview action even on confirmed create")
	assert.Equal(t, "create", resp.Actions[0].Operation)
}

func TestExecute_CreatePreview(t *testing.T) {
	businessLayer, conf := setupTest(t)
	r := reqWithAuth()

	args := baseWriteArgs("create")
	args["confirmed"] = false
	args["data"] = `{"spec":{"hosts":["reviews"]}}`

	res, status := Execute(kialiIntf(r, businessLayer, conf), args)
	require.Equal(t, http.StatusOK, status)

	b, err := json.Marshal(res)
	require.NoError(t, err)
	var resp previewResponse
	require.NoError(t, json.Unmarshal(b, &resp))

	require.Len(t, resp.Actions, 1)
	assert.Equal(t, "create", resp.Actions[0].Operation)
	assert.Contains(t, resp.Result, "PREVIEW READY")
}

func TestExecute_PatchConfirmed(t *testing.T) {
	businessLayer, conf := setupTest(t, existingVS())
	r := reqWithAuth()

	args := baseWriteArgs("patch")
	args["data"] = `{"spec":{"hosts":["reviews","ratings"]}}`

	res, status := Execute(kialiIntf(r, businessLayer, conf), args)
	require.Equal(t, http.StatusOK, status)

	b, err := json.Marshal(res)
	require.NoError(t, err)
	var resp previewResponse
	require.NoError(t, json.Unmarshal(b, &resp))

	require.Len(t, resp.Actions, 1)
	assert.Equal(t, "patch", resp.Actions[0].Operation)
}

func TestExecute_PatchPreview(t *testing.T) {
	businessLayer, conf := setupTest(t, existingVS())
	r := reqWithAuth()

	args := baseWriteArgs("patch")
	args["confirmed"] = false
	args["data"] = `{"spec":{"hosts":["reviews","ratings"]}}`

	res, status := Execute(kialiIntf(r, businessLayer, conf), args)
	require.Equal(t, http.StatusOK, status)

	b, err := json.Marshal(res)
	require.NoError(t, err)
	var resp previewResponse
	require.NoError(t, json.Unmarshal(b, &resp))

	require.Len(t, resp.Actions, 1)
	assert.Equal(t, "patch", resp.Actions[0].Operation)
	assert.Contains(t, resp.Result, "PREVIEW READY")
}

func TestExecute_DeleteConfirmed(t *testing.T) {
	businessLayer, conf := setupTest(t, existingVS())
	r := reqWithAuth()

	args := baseWriteArgs("delete")

	res, status := Execute(kialiIntf(r, businessLayer, conf), args)
	assert.Equal(t, http.StatusOK, status)
	resStr, ok := res.(string)
	require.True(t, ok)
	assert.Contains(t, resStr, "Successfully deleted")
}

func TestExecute_DeletePreview(t *testing.T) {
	businessLayer, conf := setupTest(t, existingVS())
	r := reqWithAuth()

	args := baseWriteArgs("delete")
	args["confirmed"] = false

	res, status := Execute(kialiIntf(r, businessLayer, conf), args)
	require.Equal(t, http.StatusOK, status)

	b, err := json.Marshal(res)
	require.NoError(t, err)
	var resp previewResponse
	require.NoError(t, json.Unmarshal(b, &resp))

	require.Len(t, resp.Actions, 1)
	assert.Equal(t, "delete", resp.Actions[0].Operation)
	assert.Contains(t, resp.Result, "PREVIEW READY")
}

// ---------------------------------------------------------------------------
// 3. Execute – redirects list/get to manage_istio_config_read
// ---------------------------------------------------------------------------

func TestExecute_RejectsListAction(t *testing.T) {
	businessLayer, conf := setupTest(t)
	r := reqWithAuth()

	args := map[string]interface{}{
		"action":    "list",
		"confirmed": true,
	}

	res, status := Execute(kialiIntf(r, businessLayer, conf), args)
	assert.Equal(t, http.StatusBadRequest, status)
	assert.Contains(t, res.(string), "manage_istio_config_read")
}

func TestExecute_RejectsGetAction(t *testing.T) {
	businessLayer, conf := setupTest(t)
	r := reqWithAuth()

	args := map[string]interface{}{
		"action":    "get",
		"confirmed": true,
	}

	res, status := Execute(kialiIntf(r, businessLayer, conf), args)
	assert.Equal(t, http.StatusBadRequest, status)
	assert.Contains(t, res.(string), "manage_istio_config_read")
}

// ---------------------------------------------------------------------------
// 4. ExecuteReadOnly tests
// ---------------------------------------------------------------------------

func TestExecuteReadOnly_InvalidAction(t *testing.T) {
	businessLayer, conf := setupTest(t)
	r := reqWithAuth()

	args := map[string]interface{}{
		"action": "delete",
	}

	res, status := ExecuteReadOnly(kialiIntf(r, businessLayer, conf), args)
	assert.Equal(t, http.StatusOK, status)
	assert.Contains(t, res, "invalid action")
}

func TestExecuteReadOnly_ListSuccess(t *testing.T) {
	businessLayer, conf := setupTest(t, existingVS(), existingDR())
	r := reqWithAuth()

	args := map[string]interface{}{
		"action":    "list",
		"namespace": "bookinfo",
	}

	res, status := ExecuteReadOnly(kialiIntf(r, businessLayer, conf), args)
	require.Equal(t, http.StatusOK, status)

	items, ok := res.([]IstioListItem)
	require.True(t, ok, "expected []IstioListItem, got %T", res)
	assert.GreaterOrEqual(t, len(items), 2)
}

func TestExecuteReadOnly_GetSuccess(t *testing.T) {
	businessLayer, conf := setupTest(t, existingVS())
	r := reqWithAuth()

	args := map[string]interface{}{
		"action":    "get",
		"namespace": "bookinfo",
		"group":     "networking.istio.io",
		"version":   "v1",
		"kind":      "VirtualService",
		"object":    "reviews",
	}

	res, status := ExecuteReadOnly(kialiIntf(r, businessLayer, conf), args)
	require.Equal(t, http.StatusOK, status)
	assert.NotNil(t, res)
}

func TestExecuteReadOnly_GetNonExistentConfig(t *testing.T) {
	businessLayer, conf := setupTest(t)
	r := reqWithAuth()

	args := map[string]interface{}{
		"action":    "get",
		"namespace": "bookinfo",
		"group":     "networking.istio.io",
		"version":   "v1",
		"kind":      "VirtualService",
		"object":    "does-not-exist",
	}

	res, status := ExecuteReadOnly(kialiIntf(r, businessLayer, conf), args)
	assert.Equal(t, http.StatusOK, status)
	resStr, ok := res.(string)
	require.True(t, ok)
	assert.Contains(t, resStr, "not found")
	assert.Contains(t, resStr, "does-not-exist")
}

func TestExecuteReadOnly_GetNonExistentNamespace(t *testing.T) {
	businessLayer, conf := setupTest(t)
	r := reqWithAuth()

	args := map[string]interface{}{
		"action":    "get",
		"namespace": "nonexistent-ns",
		"group":     "networking.istio.io",
		"version":   "v1",
		"kind":      "VirtualService",
		"object":    "reviews",
	}

	res, status := ExecuteReadOnly(kialiIntf(r, businessLayer, conf), args)
	assert.Equal(t, http.StatusNotFound, status, "missing namespace should return 404")
	resStr, ok := res.(string)
	require.True(t, ok)
	assert.Contains(t, resStr, "nonexistent-ns")
	assert.Contains(t, resStr, "does not exist in cluster")
}

// ---------------------------------------------------------------------------
// 5. Corner cases
// ---------------------------------------------------------------------------

func TestExecute_InvalidYAMLData(t *testing.T) {
	businessLayer, conf := setupTest(t)
	r := reqWithAuth()

	args := baseWriteArgs("create")
	args["data"] = `{invalid yaml:::}`

	res, status := Execute(kialiIntf(r, businessLayer, conf), args)
	assert.Equal(t, http.StatusOK, status, "confirmed=true should attempt the create; the business layer returns the error")

	b, err := json.Marshal(res)
	require.NoError(t, err)
	var resp previewResponse
	require.NoError(t, json.Unmarshal(b, &resp))
	assert.NotNil(t, resp.Result)
}

func TestExecute_UnmanagedGVK(t *testing.T) {
	businessLayer, conf := setupTest(t)
	r := reqWithAuth()

	args := map[string]interface{}{
		"action":    "create",
		"confirmed": true,
		"namespace": "bookinfo",
		"group":     "unknown.group",
		"version":   "v1",
		"kind":      "UnknownKind",
		"object":    "test",
		"data":      "{}",
	}

	res, status := Execute(kialiIntf(r, businessLayer, conf), args)
	assert.Equal(t, http.StatusBadRequest, status)
	resStr, ok := res.(string)
	require.True(t, ok)
	assert.Contains(t, resStr, "invalid group")
}

func TestExecuteReadOnly_UnmanagedGVK(t *testing.T) {
	businessLayer, conf := setupTest(t)
	r := reqWithAuth()

	args := map[string]interface{}{
		"action":    "get",
		"namespace": "bookinfo",
		"group":     "unknown.group",
		"version":   "v1",
		"kind":      "UnknownKind",
		"object":    "test",
	}

	res, status := ExecuteReadOnly(kialiIntf(r, businessLayer, conf), args)
	assert.Equal(t, http.StatusOK, status)
	resStr, ok := res.(string)
	require.True(t, ok)
	assert.Contains(t, resStr, "invalid group")
}

// manage_istio_config only allows networking.istio.io and security.istio.io; Gateway API
// groups are rejected before GetIstioAPI (no v1beta1 hint path for this tool).
func TestExecuteReadOnly_GatewayAPIv1beta1Hint(t *testing.T) {
	businessLayer, conf := setupTest(t)
	r := reqWithAuth()

	args := map[string]interface{}{
		"action":    "get",
		"namespace": "bookinfo",
		"group":     "gateway.networking.k8s.io",
		"version":   "v1beta1",
		"kind":      "Gateway",
		"object":    "test",
	}

	res, status := ExecuteReadOnly(kialiIntf(r, businessLayer, conf), args)
	assert.Equal(t, http.StatusOK, status)
	resStr, ok := res.(string)
	require.True(t, ok)
	assert.Contains(t, resStr, "invalid group")
}

func TestExecute_DeleteNonExistentResource(t *testing.T) {
	businessLayer, conf := setupTest(t)
	r := reqWithAuth()

	args := baseWriteArgs("delete")
	args["object"] = "does-not-exist"

	res, status := Execute(kialiIntf(r, businessLayer, conf), args)
	assert.Equal(t, http.StatusOK, status, "confirmed=true errors must return 200 so the LLM sees the failure")
	resStr, ok := res.(string)
	require.True(t, ok)
	assert.Contains(t, resStr, "ERROR:")
	assert.Contains(t, resStr, "not found")
	assert.Contains(t, resStr, "does-not-exist")
}

func TestExecute_InvalidActionForWrite(t *testing.T) {
	businessLayer, conf := setupTest(t)
	r := reqWithAuth()

	args := map[string]interface{}{
		"action":    "invalid",
		"confirmed": true,
		"namespace": "bookinfo",
		"group":     "networking.istio.io",
		"version":   "v1",
		"kind":      "VirtualService",
		"object":    "test",
		"data":      "{}",
	}

	res, status := Execute(kialiIntf(r, businessLayer, conf), args)
	assert.Equal(t, http.StatusBadRequest, status)
	assert.Contains(t, res, "invalid action")
}

func TestExecute_CreateWithYAMLPayload(t *testing.T) {
	businessLayer, conf := setupTest(t)
	r := reqWithAuth()

	yamlData := `
metadata:
  name: ratings-vs
  namespace: bookinfo
spec:
  hosts:
    - ratings
  http:
    - route:
        - destination:
            host: ratings
`
	args := baseWriteArgs("create")
	args["object"] = "ratings-vs"
	args["data"] = yamlData

	res, status := Execute(kialiIntf(r, businessLayer, conf), args)
	require.Equal(t, http.StatusOK, status)

	b, err := json.Marshal(res)
	require.NoError(t, err)
	var resp previewResponse
	require.NoError(t, json.Unmarshal(b, &resp))
	require.Len(t, resp.Actions, 1)
	assert.Equal(t, "create", resp.Actions[0].Operation)
}

func TestExecute_PatchWithYAMLPayload(t *testing.T) {
	businessLayer, conf := setupTest(t, existingVS())
	r := reqWithAuth()

	yamlPatch := `
spec:
  hosts:
    - reviews
    - reviews-v2
`
	args := baseWriteArgs("patch")
	args["data"] = yamlPatch

	res, status := Execute(kialiIntf(r, businessLayer, conf), args)
	require.Equal(t, http.StatusOK, status)

	b, err := json.Marshal(res)
	require.NoError(t, err)
	var resp previewResponse
	require.NoError(t, json.Unmarshal(b, &resp))
	require.Len(t, resp.Actions, 1)
	assert.Equal(t, "patch", resp.Actions[0].Operation)
}

func TestExecute_DefaultClusterUsed(t *testing.T) {
	businessLayer, conf := setupTest(t, existingVS())
	r := reqWithAuth()

	args := baseWriteArgs("delete")
	// Deliberately omit "cluster" so the default is used.
	delete(args, "cluster")

	res, status := Execute(kialiIntf(r, businessLayer, conf), args)
	assert.Equal(t, http.StatusOK, status)
	resStr, ok := res.(string)
	require.True(t, ok)
	assert.Contains(t, resStr, "Successfully deleted")
}

func TestExecute_CreateMissingRequiredField(t *testing.T) {
	businessLayer, conf := setupTest(t)
	r := reqWithAuth()

	args := baseWriteArgs("create")
	// Missing "data" field
	delete(args, "data")

	res, status := Execute(kialiIntf(r, businessLayer, conf), args)
	assert.Equal(t, http.StatusBadRequest, status)
	assert.Contains(t, res, "data is required")
}

func TestExecute_PatchMissingData(t *testing.T) {
	businessLayer, conf := setupTest(t, existingVS())
	r := reqWithAuth()

	args := baseWriteArgs("patch")
	// Missing "data" field
	delete(args, "data")

	res, status := Execute(kialiIntf(r, businessLayer, conf), args)
	assert.Equal(t, http.StatusBadRequest, status)
	assert.Contains(t, res, "data is required")
}

func TestExecute_DeleteMissingObject(t *testing.T) {
	businessLayer, conf := setupTest(t)
	r := reqWithAuth()

	args := baseWriteArgs("delete")
	delete(args, "object")

	res, status := Execute(kialiIntf(r, businessLayer, conf), args)
	assert.Equal(t, http.StatusBadRequest, status)
	assert.Contains(t, res, "object (resource name) is required")
}

// ---------------------------------------------------------------------------
// 6. Preview action metadata tests
// ---------------------------------------------------------------------------

func TestCreateFileAction_Metadata(t *testing.T) {
	businessLayer, conf := setupTest(t, existingVS())

	args := map[string]interface{}{
		"action":      "patch",
		"namespace":   "bookinfo",
		"group":       "networking.istio.io",
		"version":     "v1",
		"kind":        "VirtualService",
		"object":      "reviews",
		"clusterName": "east",
		"data":        `{"spec":{"hosts":["reviews"]}}`,
	}

	actions := createFileAction(reqWithAuth().Context(), args, businessLayer, conf)
	require.Len(t, actions, 1)

	a := actions[0]
	assert.Equal(t, "patch", a.Operation)
	assert.Equal(t, "east", a.Cluster)
	assert.Equal(t, "bookinfo", a.Namespace)
	assert.Equal(t, "networking.istio.io", a.Group)
	assert.Equal(t, "v1", a.Version)
	assert.Equal(t, "VirtualService", a.KindName)
	assert.Equal(t, "reviews", a.Object)
	assert.Equal(t, get_action_ui.ActionKindFile, a.Kind)
	assert.Contains(t, a.FileName, "vs_reviews")
	assert.NotEmpty(t, a.Payload)
}

func TestCreateFileAction_DeleteStubManifest(t *testing.T) {
	businessLayer, conf := setupTest(t)

	args := map[string]interface{}{
		"action":      "delete",
		"namespace":   "bookinfo",
		"group":       "networking.istio.io",
		"version":     "v1",
		"kind":        "VirtualService",
		"object":      "reviews",
		"clusterName": "east",
		"data":        "",
	}

	actions := createFileAction(reqWithAuth().Context(), args, businessLayer, conf)
	require.Len(t, actions, 1)

	a := actions[0]
	assert.Equal(t, "delete", a.Operation)
	assert.Contains(t, a.Payload, "apiVersion")
	assert.Contains(t, a.Payload, "networking.istio.io/v1")
	assert.Contains(t, a.Payload, "reviews")
}

// ---------------------------------------------------------------------------
// 7. IstioCreate / IstioPatch / IstioDelete direct tests
// ---------------------------------------------------------------------------

func TestIstioCreate_ValidJSON(t *testing.T) {
	businessLayer, conf := setupTest(t)
	r := reqWithAuth()

	args := map[string]interface{}{
		"namespace": "bookinfo",
		"group":     "networking.istio.io",
		"version":   "v1",
		"kind":      "VirtualService",
		"data":      `{"metadata":{"name":"new-vs","namespace":"bookinfo"},"spec":{"hosts":["new-svc"]}}`,
	}

	res, status := IstioCreate(r, args, businessLayer, conf)
	assert.Equal(t, http.StatusOK, status)
	assert.NotNil(t, res)
}

func TestIstioCreate_InvalidJSON(t *testing.T) {
	businessLayer, conf := setupTest(t)
	r := reqWithAuth()

	args := map[string]interface{}{
		"namespace": "bookinfo",
		"group":     "networking.istio.io",
		"version":   "v1",
		"kind":      "VirtualService",
		"data":      "{",
	}

	res, status := IstioCreate(r, args, businessLayer, conf)
	assert.Equal(t, http.StatusBadRequest, status)
	resStr, ok := res.(string)
	require.True(t, ok)
	assert.Contains(t, resStr, "Invalid data")
}

func TestIstioCreate_AlreadyExists(t *testing.T) {
	businessLayer, conf := setupTest(t, existingVS())
	r := reqWithAuth()

	args := map[string]interface{}{
		"namespace": "bookinfo",
		"group":     "networking.istio.io",
		"version":   "v1",
		"kind":      "VirtualService",
		"object":    "reviews",
		"data":      `{"metadata":{"name":"reviews","namespace":"bookinfo"},"spec":{"hosts":["reviews"]}}`,
	}

	res, status := IstioCreate(r, args, businessLayer, conf)
	assert.Equal(t, http.StatusConflict, status)
	resStr, ok := res.(string)
	require.True(t, ok)
	assert.Contains(t, resStr, "already exists")
	assert.Contains(t, resStr, "patch")
}

func TestIstioCreate_UnmanagedType(t *testing.T) {
	businessLayer, conf := setupTest(t)
	r := reqWithAuth()

	args := map[string]interface{}{
		"namespace": "bookinfo",
		"group":     "fake.group",
		"version":   "v1",
		"kind":      "FakeKind",
		"data":      "{}",
	}

	res, status := IstioCreate(r, args, businessLayer, conf)
	assert.Equal(t, http.StatusBadRequest, status)
	resStr, ok := res.(string)
	require.True(t, ok)
	assert.Contains(t, resStr, "Object type not managed")
}

func TestIstioPatch_ValidPatch(t *testing.T) {
	businessLayer, conf := setupTest(t, existingVS())
	r := reqWithAuth()

	args := map[string]interface{}{
		"namespace": "bookinfo",
		"group":     "networking.istio.io",
		"version":   "v1",
		"kind":      "VirtualService",
		"object":    "reviews",
		"data":      `{"spec":{"hosts":["reviews","ratings"]}}`,
	}

	res, status := IstioPatch(r, args, businessLayer, conf)
	assert.Equal(t, http.StatusOK, status)
	assert.NotNil(t, res)
}

func TestIstioPatch_InvalidYAML(t *testing.T) {
	businessLayer, conf := setupTest(t, existingVS())
	r := reqWithAuth()

	args := map[string]interface{}{
		"namespace": "bookinfo",
		"group":     "networking.istio.io",
		"version":   "v1",
		"kind":      "VirtualService",
		"object":    "reviews",
		"data":      "{",
	}

	res, status := IstioPatch(r, args, businessLayer, conf)
	assert.Equal(t, http.StatusBadRequest, status)
	resStr, ok := res.(string)
	require.True(t, ok)
	assert.Contains(t, resStr, "Invalid data")
}

func TestIstioPatch_NonExistent(t *testing.T) {
	businessLayer, conf := setupTest(t)
	r := reqWithAuth()

	args := map[string]interface{}{
		"namespace": "bookinfo",
		"group":     "networking.istio.io",
		"version":   "v1",
		"kind":      "VirtualService",
		"object":    "does-not-exist",
		"data":      `{"spec":{"hosts":["reviews"]}}`,
	}

	res, status := IstioPatch(r, args, businessLayer, conf)
	assert.Equal(t, http.StatusNotFound, status)
	resStr, ok := res.(string)
	require.True(t, ok)
	assert.Contains(t, resStr, "not found")
	assert.Contains(t, resStr, "does-not-exist")
}

func TestIstioPatch_UnmanagedType(t *testing.T) {
	businessLayer, conf := setupTest(t)
	r := reqWithAuth()

	args := map[string]interface{}{
		"namespace": "bookinfo",
		"group":     "fake.group",
		"version":   "v1",
		"kind":      "FakeKind",
		"object":    "x",
		"data":      "{}",
	}

	res, status := IstioPatch(r, args, businessLayer, conf)
	assert.Equal(t, http.StatusBadRequest, status)
	resStr, ok := res.(string)
	require.True(t, ok)
	assert.Contains(t, resStr, "Object type not managed")
}

func TestIstioDelete_Success(t *testing.T) {
	businessLayer, conf := setupTest(t, existingVS())
	r := reqWithAuth()

	args := map[string]interface{}{
		"namespace": "bookinfo",
		"group":     "networking.istio.io",
		"version":   "v1",
		"kind":      "VirtualService",
		"object":    "reviews",
	}

	res, status := IstioDelete(r, args, businessLayer, conf)
	assert.Equal(t, http.StatusOK, status)
	resStr, ok := res.(string)
	require.True(t, ok)
	assert.Contains(t, resStr, "Successfully deleted")
	assert.Contains(t, resStr, "reviews")
}

func TestIstioDelete_NonExistent(t *testing.T) {
	businessLayer, conf := setupTest(t)
	r := reqWithAuth()

	args := map[string]interface{}{
		"namespace": "bookinfo",
		"group":     "networking.istio.io",
		"version":   "v1",
		"kind":      "VirtualService",
		"object":    "does-not-exist",
	}

	res, status := IstioDelete(r, args, businessLayer, conf)
	assert.Equal(t, http.StatusNotFound, status)
	resStr, ok := res.(string)
	require.True(t, ok)
	assert.Contains(t, resStr, "Resource not found")
	assert.Contains(t, resStr, "does-not-exist")
}

func TestIstioDelete_UnmanagedType(t *testing.T) {
	businessLayer, conf := setupTest(t)
	r := reqWithAuth()

	args := map[string]interface{}{
		"namespace": "bookinfo",
		"group":     "fake.group",
		"version":   "v1",
		"kind":      "FakeKind",
		"object":    "x",
	}

	res, status := IstioDelete(r, args, businessLayer, conf)
	assert.Equal(t, http.StatusBadRequest, status)
	resStr, ok := res.(string)
	require.True(t, ok)
	assert.Contains(t, resStr, "Object type not managed")
}

// ---------------------------------------------------------------------------
// 8. normalizeToYAML / stubManifestYAML helpers
// ---------------------------------------------------------------------------

func TestNormalizeToYAML_ValidJSON(t *testing.T) {
	out, err := normalizeToYAML(`{"key":"value"}`)
	require.NoError(t, err)
	assert.Contains(t, out, "key: value")
	assert.True(t, out[len(out)-1] == '\n')
}

func TestNormalizeToYAML_ValidYAML(t *testing.T) {
	out, err := normalizeToYAML("key: value\n")
	require.NoError(t, err)
	assert.Contains(t, out, "key: value")
}

func TestNormalizeToYAML_InvalidInput(t *testing.T) {
	_, err := normalizeToYAML("{")
	assert.Error(t, err)
}

func TestStubManifestYAML(t *testing.T) {
	out := stubManifestYAML("networking.istio.io/v1", "VirtualService", "reviews", "bookinfo")
	assert.Contains(t, out, "apiVersion: networking.istio.io/v1")
	assert.Contains(t, out, "kind: VirtualService")
	assert.Contains(t, out, "name: reviews")
	assert.Contains(t, out, "namespace: bookinfo")
}

// ---------------------------------------------------------------------------
// 9. buildResourceTemplate tests
// ---------------------------------------------------------------------------

func TestBuildResourceTemplate_Gateway(t *testing.T) {
	gvk := networking_v1.SchemeGroupVersion.WithKind("Gateway")
	gvk.Group = "networking.istio.io"
	tpl := buildResourceTemplate(gvk, "my-gw", "bookinfo")

	assert.Equal(t, "networking.istio.io/v1", tpl["apiVersion"])
	assert.Equal(t, "Gateway", tpl["kind"])
	spec, ok := tpl["spec"].(map[string]interface{})
	require.True(t, ok)
	assert.NotNil(t, spec["selector"])
	assert.NotNil(t, spec["servers"])
}

func TestBuildResourceTemplate_VirtualService(t *testing.T) {
	gvk := networking_v1.SchemeGroupVersion.WithKind("VirtualService")
	gvk.Group = "networking.istio.io"
	tpl := buildResourceTemplate(gvk, "my-vs", "bookinfo")

	spec, ok := tpl["spec"].(map[string]interface{})
	require.True(t, ok)
	assert.NotNil(t, spec["hosts"])
	assert.NotNil(t, spec["http"])
}

func TestBuildResourceTemplate_DestinationRule(t *testing.T) {
	gvk := networking_v1.SchemeGroupVersion.WithKind("DestinationRule")
	gvk.Group = "networking.istio.io"
	tpl := buildResourceTemplate(gvk, "my-dr", "bookinfo")

	spec, ok := tpl["spec"].(map[string]interface{})
	require.True(t, ok)
	assert.NotNil(t, spec["host"])
}

func TestBuildResourceTemplate_UnknownType(t *testing.T) {
	gvk := networking_v1.SchemeGroupVersion.WithKind("SomeOtherKind")
	gvk.Group = "networking.istio.io"
	tpl := buildResourceTemplate(gvk, "x", "bookinfo")

	assert.Equal(t, "networking.istio.io/v1", tpl["apiVersion"])
	assert.Equal(t, "SomeOtherKind", tpl["kind"])
	// No spec for unknown types.
	_, hasSpec := tpl["spec"]
	assert.False(t, hasSpec)
}

// ---------------------------------------------------------------------------
// 10. DestinationRule CRUD through Execute
// ---------------------------------------------------------------------------

func TestExecute_CreateDestinationRule(t *testing.T) {
	businessLayer, conf := setupTest(t)
	r := reqWithAuth()

	args := map[string]interface{}{
		"action":    "create",
		"confirmed": true,
		"namespace": "bookinfo",
		"group":     "networking.istio.io",
		"version":   "v1",
		"kind":      "DestinationRule",
		"object":    "ratings-dr",
		"data":      `{"metadata":{"name":"ratings-dr","namespace":"bookinfo"},"spec":{"host":"ratings"}}`,
	}

	res, status := Execute(kialiIntf(r, businessLayer, conf), args)
	require.Equal(t, http.StatusOK, status)

	b, err := json.Marshal(res)
	require.NoError(t, err)
	var resp previewResponse
	require.NoError(t, json.Unmarshal(b, &resp))
	require.Len(t, resp.Actions, 1)
	assert.Equal(t, "create", resp.Actions[0].Operation)
	assert.Equal(t, "DestinationRule", resp.Actions[0].KindName)
}

func TestExecute_DeleteDestinationRule(t *testing.T) {
	businessLayer, conf := setupTest(t, existingDR())
	r := reqWithAuth()

	args := map[string]interface{}{
		"action":    "delete",
		"confirmed": true,
		"namespace": "bookinfo",
		"group":     "networking.istio.io",
		"version":   "v1",
		"kind":      "DestinationRule",
		"object":    "reviews-dr",
	}

	res, status := Execute(kialiIntf(r, businessLayer, conf), args)
	assert.Equal(t, http.StatusOK, status)
	resStr, ok := res.(string)
	require.True(t, ok)
	assert.Contains(t, resStr, "Successfully deleted")
}

// ---------------------------------------------------------------------------
// 11. Data whitespace edge cases
// ---------------------------------------------------------------------------

func TestExecute_CreateWithWhitespaceOnlyData(t *testing.T) {
	businessLayer, conf := setupTest(t)
	r := reqWithAuth()

	args := baseWriteArgs("create")
	args["data"] = "   "

	res, status := Execute(kialiIntf(r, businessLayer, conf), args)
	assert.Equal(t, http.StatusBadRequest, status)
	assert.Contains(t, res, "data is required")
}

func TestExecute_PatchWithWhitespaceOnlyData(t *testing.T) {
	businessLayer, conf := setupTest(t, existingVS())
	r := reqWithAuth()

	args := baseWriteArgs("patch")
	args["data"] = "\t\n  "

	res, status := Execute(kialiIntf(r, businessLayer, conf), args)
	assert.Equal(t, http.StatusBadRequest, status)
	assert.Contains(t, res, "data is required")
}

// ---------------------------------------------------------------------------
// 12. Pre-check: existence verification before mutations (through Execute)
// ---------------------------------------------------------------------------

func TestExecute_PatchNonExistentResource(t *testing.T) {
	businessLayer, conf := setupTest(t)
	r := reqWithAuth()

	args := baseWriteArgs("patch")
	args["object"] = "does-not-exist"
	args["data"] = `{"spec":{"hosts":["reviews"]}}`

	res, status := Execute(kialiIntf(r, businessLayer, conf), args)
	assert.Equal(t, http.StatusOK, status, "confirmed=true errors must return 200 so the LLM sees the failure")

	b, err := json.Marshal(res)
	require.NoError(t, err)
	var resp previewResponse
	require.NoError(t, json.Unmarshal(b, &resp))
	require.Len(t, resp.Actions, 1)

	resStr, ok := resp.Result.(string)
	require.True(t, ok)
	assert.Contains(t, resStr, "ERROR:")
	assert.Contains(t, resStr, "not found")
	assert.Contains(t, resStr, "does-not-exist")
}

func TestExecute_CreateAlreadyExistsDestinationRule(t *testing.T) {
	businessLayer, conf := setupTest(t, existingDR())
	r := reqWithAuth()

	args := map[string]interface{}{
		"action":    "create",
		"confirmed": true,
		"namespace": "bookinfo",
		"group":     "networking.istio.io",
		"version":   "v1",
		"kind":      "DestinationRule",
		"object":    "reviews-dr",
		"data":      `{"metadata":{"name":"reviews-dr","namespace":"bookinfo"},"spec":{"host":"reviews"}}`,
	}

	res, status := Execute(kialiIntf(r, businessLayer, conf), args)
	assert.Equal(t, http.StatusOK, status, "confirmed=true errors must return 200 so the LLM sees the failure")

	b, err := json.Marshal(res)
	require.NoError(t, err)
	var resp previewResponse
	require.NoError(t, json.Unmarshal(b, &resp))
	require.Len(t, resp.Actions, 1)

	resStr, ok := resp.Result.(string)
	require.True(t, ok)
	assert.Contains(t, resStr, "ERROR:")
	assert.Contains(t, resStr, "already exists")
	assert.Contains(t, resStr, "patch")
}

func TestExecute_PatchNonExistentDestinationRule(t *testing.T) {
	businessLayer, conf := setupTest(t)
	r := reqWithAuth()

	args := map[string]interface{}{
		"action":    "patch",
		"confirmed": true,
		"namespace": "bookinfo",
		"group":     "networking.istio.io",
		"version":   "v1",
		"kind":      "DestinationRule",
		"object":    "no-such-dr",
		"data":      `{"spec":{"host":"reviews"}}`,
	}

	res, status := Execute(kialiIntf(r, businessLayer, conf), args)
	assert.Equal(t, http.StatusOK, status, "confirmed=true errors must return 200 so the LLM sees the failure")

	b, err := json.Marshal(res)
	require.NoError(t, err)
	var resp previewResponse
	require.NoError(t, json.Unmarshal(b, &resp))

	resStr, ok := resp.Result.(string)
	require.True(t, ok)
	assert.Contains(t, resStr, "ERROR:")
	assert.Contains(t, resStr, "not found")
	assert.Contains(t, resStr, "no-such-dr")
}

func TestExecute_DeleteNonExistentDestinationRule(t *testing.T) {
	businessLayer, conf := setupTest(t)
	r := reqWithAuth()

	args := map[string]interface{}{
		"action":    "delete",
		"confirmed": true,
		"namespace": "bookinfo",
		"group":     "networking.istio.io",
		"version":   "v1",
		"kind":      "DestinationRule",
		"object":    "no-such-dr",
	}

	res, status := Execute(kialiIntf(r, businessLayer, conf), args)
	assert.Equal(t, http.StatusOK, status, "confirmed=true errors must return 200 so the LLM sees the failure")
	resStr, ok := res.(string)
	require.True(t, ok)
	assert.Contains(t, resStr, "ERROR:")
	assert.Contains(t, resStr, "not found")
	assert.Contains(t, resStr, "no-such-dr")
}

// ---------------------------------------------------------------------------
// 13. Panic recovery tests
// ---------------------------------------------------------------------------

func TestRecoverFromPanic_CatchesPanic(t *testing.T) {
	var res interface{}
	var status int

	func() {
		defer recoverFromPanic(&res, &status, "VirtualService", "reviews", "bookinfo")
		panic("simulated nil pointer dereference")
	}()

	assert.Equal(t, http.StatusInternalServerError, status)
	resStr, ok := res.(string)
	require.True(t, ok)
	assert.Contains(t, resStr, "Internal error")
	assert.Contains(t, resStr, "VirtualService")
	assert.Contains(t, resStr, "reviews")
	assert.Contains(t, resStr, "bookinfo")
}

func TestRecoverFromPanic_NoPanic(t *testing.T) {
	var res interface{}
	var status int

	func() {
		defer recoverFromPanic(&res, &status, "VirtualService", "reviews", "bookinfo")
		res = "success"
		status = http.StatusOK
	}()

	assert.Equal(t, http.StatusOK, status)
	assert.Equal(t, "success", res)
}

// ---------------------------------------------------------------------------
// 14. classifyError tests
// ---------------------------------------------------------------------------

func TestClassifyError(t *testing.T) {
	tests := []struct {
		name       string
		err        error
		wantStatus int
		wantMsg    string
	}{
		{
			name:       "not found",
			err:        api_errors.NewNotFound(schema.GroupResource{Group: "networking.istio.io", Resource: "virtualservices"}, "reviews"),
			wantStatus: http.StatusNotFound,
			wantMsg:    "not found",
		},
		{
			name:       "already exists",
			err:        api_errors.NewAlreadyExists(schema.GroupResource{Group: "networking.istio.io", Resource: "virtualservices"}, "reviews"),
			wantStatus: http.StatusConflict,
			wantMsg:    "already exists",
		},
		{
			name:       "forbidden",
			err:        api_errors.NewForbidden(schema.GroupResource{Group: "networking.istio.io", Resource: "virtualservices"}, "reviews", fmt.Errorf("not allowed")),
			wantStatus: http.StatusForbidden,
			wantMsg:    "Access denied",
		},
		{
			name:       "conflict",
			err:        api_errors.NewConflict(schema.GroupResource{Group: "networking.istio.io", Resource: "virtualservices"}, "reviews", fmt.Errorf("modified")),
			wantStatus: http.StatusConflict,
			wantMsg:    "Conflict",
		},
		{
			name:       "bad request",
			err:        api_errors.NewBadRequest("invalid field"),
			wantStatus: http.StatusBadRequest,
			wantMsg:    "invalid field",
		},
		{
			name:       "unknown error",
			err:        fmt.Errorf("something unexpected"),
			wantStatus: http.StatusInternalServerError,
			wantMsg:    "something unexpected",
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			msg, status := classifyError(tt.err, "VirtualService", "reviews", "bookinfo")
			assert.Equal(t, tt.wantStatus, status)
			assert.Contains(t, msg, tt.wantMsg)
		})
	}
}

// ---------------------------------------------------------------------------
// 15. Namespace existence pre-check tests
// ---------------------------------------------------------------------------

func TestIstioCreate_NamespaceDoesNotExist(t *testing.T) {
	businessLayer, conf := setupTest(t)
	r := reqWithAuth()

	args := map[string]interface{}{
		"namespace": "nonexistent-ns",
		"group":     "networking.istio.io",
		"version":   "v1",
		"kind":      "VirtualService",
		"object":    "reviews",
		"data":      `{"metadata":{"name":"reviews","namespace":"nonexistent-ns"},"spec":{"hosts":["reviews"]}}`,
	}

	res, status := IstioCreate(r, args, businessLayer, conf)
	assert.Equal(t, http.StatusNotFound, status, "missing namespace should return 404")
	resStr, ok := res.(string)
	require.True(t, ok)
	assert.Contains(t, resStr, "nonexistent-ns")
	assert.Contains(t, resStr, "does not exist in cluster")
}

func TestIstioPatch_NamespaceDoesNotExist(t *testing.T) {
	businessLayer, conf := setupTest(t)
	r := reqWithAuth()

	args := map[string]interface{}{
		"namespace": "nonexistent-ns",
		"group":     "networking.istio.io",
		"version":   "v1",
		"kind":      "VirtualService",
		"object":    "reviews",
		"data":      `{"spec":{"hosts":["reviews"]}}`,
	}

	res, status := IstioPatch(r, args, businessLayer, conf)
	assert.Equal(t, http.StatusNotFound, status, "missing namespace should return 404")
	resStr, ok := res.(string)
	require.True(t, ok)
	assert.Contains(t, resStr, "nonexistent-ns")
	assert.Contains(t, resStr, "does not exist in cluster")
}

func TestIstioDelete_NamespaceDoesNotExist(t *testing.T) {
	businessLayer, conf := setupTest(t)
	r := reqWithAuth()

	args := map[string]interface{}{
		"namespace": "nonexistent-ns",
		"group":     "networking.istio.io",
		"version":   "v1",
		"kind":      "VirtualService",
		"object":    "reviews",
	}

	res, status := IstioDelete(r, args, businessLayer, conf)
	assert.Equal(t, http.StatusNotFound, status, "missing namespace should return 404")
	resStr, ok := res.(string)
	require.True(t, ok)
	assert.Contains(t, resStr, "nonexistent-ns")
	assert.Contains(t, resStr, "does not exist in cluster")
}

func TestExecute_CreateInNonExistentNamespace(t *testing.T) {
	businessLayer, conf := setupTest(t)
	r := reqWithAuth()

	args := map[string]interface{}{
		"action":    "create",
		"confirmed": true,
		"namespace": "nonexistent-ns",
		"group":     "networking.istio.io",
		"version":   "v1",
		"kind":      "VirtualService",
		"object":    "reviews",
		"data":      `{"metadata":{"name":"reviews","namespace":"nonexistent-ns"},"spec":{"hosts":["reviews"]}}`,
	}

	res, status := Execute(kialiIntf(r, businessLayer, conf), args)
	assert.Equal(t, http.StatusNotFound, status, "missing namespace should return 404")
	resStr, ok := res.(string)
	require.True(t, ok)
	assert.Contains(t, resStr, "nonexistent-ns")
	assert.Contains(t, resStr, "does not exist in cluster")
}

func TestExecute_CreatePreviewInNonExistentNamespace(t *testing.T) {
	businessLayer, conf := setupTest(t)
	r := reqWithAuth()

	args := map[string]interface{}{
		"action":    "create",
		"confirmed": false,
		"namespace": "nonexistent-ns",
		"group":     "networking.istio.io",
		"version":   "v1",
		"kind":      "VirtualService",
		"object":    "reviews",
		"data":      `{"metadata":{"name":"reviews","namespace":"nonexistent-ns"},"spec":{"hosts":["reviews"]}}`,
	}

	res, status := Execute(kialiIntf(r, businessLayer, conf), args)
	assert.Equal(t, http.StatusNotFound, status, "missing namespace should return 404")
	resStr, ok := res.(string)
	require.True(t, ok)
	assert.Contains(t, resStr, "nonexistent-ns")
	assert.Contains(t, resStr, "does not exist in cluster")
}

func TestExecute_PatchInNonExistentNamespace(t *testing.T) {
	businessLayer, conf := setupTest(t)
	r := reqWithAuth()

	args := map[string]interface{}{
		"action":    "patch",
		"confirmed": true,
		"namespace": "nonexistent-ns",
		"group":     "networking.istio.io",
		"version":   "v1",
		"kind":      "VirtualService",
		"object":    "reviews",
		"data":      `{"spec":{"hosts":["reviews"]}}`,
	}

	res, status := Execute(kialiIntf(r, businessLayer, conf), args)
	assert.Equal(t, http.StatusNotFound, status, "missing namespace should return 404")
	resStr, ok := res.(string)
	require.True(t, ok)
	assert.Contains(t, resStr, "nonexistent-ns")
	assert.Contains(t, resStr, "does not exist in cluster")
}

func TestExecute_PatchPreviewInNonExistentNamespace(t *testing.T) {
	businessLayer, conf := setupTest(t)
	r := reqWithAuth()

	args := map[string]interface{}{
		"action":    "patch",
		"confirmed": false,
		"namespace": "nonexistent-ns",
		"group":     "networking.istio.io",
		"version":   "v1",
		"kind":      "VirtualService",
		"object":    "reviews",
		"data":      `{"spec":{"hosts":["reviews"]}}`,
	}

	res, status := Execute(kialiIntf(r, businessLayer, conf), args)
	assert.Equal(t, http.StatusNotFound, status, "missing namespace should return 404")
	resStr, ok := res.(string)
	require.True(t, ok)
	assert.Contains(t, resStr, "nonexistent-ns")
	assert.Contains(t, resStr, "does not exist in cluster")
}

func TestExecute_DeletePreviewInNonExistentNamespace(t *testing.T) {
	businessLayer, conf := setupTest(t)
	r := reqWithAuth()

	args := map[string]interface{}{
		"action":    "delete",
		"confirmed": false,
		"namespace": "nonexistent-ns",
		"group":     "networking.istio.io",
		"version":   "v1",
		"kind":      "VirtualService",
		"object":    "reviews",
	}

	res, status := Execute(kialiIntf(r, businessLayer, conf), args)
	assert.Equal(t, http.StatusNotFound, status, "missing namespace should return 404")
	resStr, ok := res.(string)
	require.True(t, ok)
	assert.Contains(t, resStr, "nonexistent-ns")
	assert.Contains(t, resStr, "does not exist in cluster")
}

func TestExecute_DeleteInNonExistentNamespace(t *testing.T) {
	businessLayer, conf := setupTest(t)
	r := reqWithAuth()

	args := map[string]interface{}{
		"action":    "delete",
		"confirmed": true,
		"namespace": "nonexistent-ns",
		"group":     "networking.istio.io",
		"version":   "v1",
		"kind":      "VirtualService",
		"object":    "reviews",
	}

	res, status := Execute(kialiIntf(r, businessLayer, conf), args)
	assert.Equal(t, http.StatusNotFound, status, "missing namespace should return 404")
	resStr, ok := res.(string)
	require.True(t, ok)
	assert.Contains(t, resStr, "nonexistent-ns")
	assert.Contains(t, resStr, "does not exist in cluster")
}

func TestCheckNamespaceExists_ExistingNamespace(t *testing.T) {
	businessLayer, conf := setupTest(t)
	r := reqWithAuth()
	_ = r

	msg, code := checkNamespaceExists(r.Context(), businessLayer, "bookinfo", conf.KubernetesConfig.ClusterName)
	assert.Equal(t, 0, code)
	assert.Empty(t, msg)
}

func TestCheckNamespaceExists_MissingNamespace(t *testing.T) {
	businessLayer, conf := setupTest(t)
	r := reqWithAuth()

	msg, code := checkNamespaceExists(r.Context(), businessLayer, "no-such-ns", conf.KubernetesConfig.ClusterName)
	assert.Equal(t, http.StatusNotFound, code, "missing namespace should return 404")
	assert.Contains(t, msg, "no-such-ns")
	assert.Contains(t, msg, "does not exist in cluster")
}

// ---------------------------------------------------------------------------
// 16. resolveObjectName fallback tests
// ---------------------------------------------------------------------------

func TestResolveObjectName_FromObject(t *testing.T) {
	args := map[string]interface{}{"object": "my-vs"}
	assert.Equal(t, "my-vs", resolveObjectName(args))
}

func TestResolveObjectName_FromDataMetadata(t *testing.T) {
	args := map[string]interface{}{
		"data": `{"metadata":{"name":"from-data"},"spec":{"hosts":["x"]}}`,
	}
	assert.Equal(t, "from-data", resolveObjectName(args))
	assert.Equal(t, "from-data", args["object"], "should write back to args[\"object\"]")
}

func TestResolveObjectName_FromDataYAML(t *testing.T) {
	args := map[string]interface{}{
		"data": "metadata:\n  name: from-yaml\nspec:\n  hosts:\n    - x\n",
	}
	assert.Equal(t, "from-yaml", resolveObjectName(args))
	assert.Equal(t, "from-yaml", args["object"])
}

func TestResolveObjectName_Empty(t *testing.T) {
	args := map[string]interface{}{"data": "{}"}
	assert.Equal(t, "", resolveObjectName(args))
}

func TestResolveObjectName_ObjectTakesPrecedence(t *testing.T) {
	args := map[string]interface{}{
		"object": "explicit",
		"data":   `{"metadata":{"name":"from-data"}}`,
	}
	assert.Equal(t, "explicit", resolveObjectName(args))
}

func TestValidate_PatchWithNameInData(t *testing.T) {
	args := map[string]interface{}{
		"action":    "patch",
		"namespace": "bookinfo",
		"group":     "networking.istio.io",
		"version":   "v1",
		"kind":      "VirtualService",
		"data":      `{"metadata":{"name":"reviews"},"spec":{"hosts":["reviews"]}}`,
	}
	err := validateIstioConfigInput(args)
	assert.NoError(t, err, "should extract object name from data's metadata.name")
	assert.Equal(t, "reviews", args["object"])
}

func TestExecute_CreateAlreadyExistsThroughExecute(t *testing.T) {
	businessLayer, conf := setupTest(t, existingVS())
	r := reqWithAuth()

	args := baseWriteArgs("create")
	args["data"] = `{"metadata":{"name":"reviews","namespace":"bookinfo"},"spec":{"hosts":["reviews"]}}`

	res, status := Execute(kialiIntf(r, businessLayer, conf), args)
	assert.Equal(t, http.StatusOK, status, "confirmed=true errors must return 200 so the LLM sees the failure")

	b, err := json.Marshal(res)
	require.NoError(t, err)
	var resp previewResponse
	require.NoError(t, json.Unmarshal(b, &resp))
	require.Len(t, resp.Actions, 1)

	resStr, ok := resp.Result.(string)
	require.True(t, ok)
	assert.Contains(t, resStr, "ERROR:")
	assert.Contains(t, resStr, "already exists")
	assert.Contains(t, resStr, "patch")
}
