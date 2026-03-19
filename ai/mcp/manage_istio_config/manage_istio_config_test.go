package manage_istio_config

import (
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"testing"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
	istio_api_v1alpha3 "istio.io/api/networking/v1alpha3"
	networking_v1 "istio.io/client-go/pkg/apis/networking/v1"
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
	"k8s.io/apimachinery/pkg/runtime"

	"github.com/kiali/kiali/ai/mcp/get_action_ui"
	"github.com/kiali/kiali/business"
	"github.com/kiali/kiali/config"
	"github.com/kiali/kiali/kubernetes/kubetest"
)

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
			wantErr: "object is required",
		},
		{
			name:    "patch missing object",
			args:    map[string]interface{}{"action": "patch", "namespace": "bookinfo", "group": "networking.istio.io", "version": "v1", "kind": "VirtualService", "data": "{}"},
			wantErr: "name is required",
		},
		{
			name:    "patch missing data",
			args:    map[string]interface{}{"action": "patch", "namespace": "bookinfo", "group": "networking.istio.io", "version": "v1", "kind": "VirtualService", "object": "x"},
			wantErr: "data is required",
		},
		{
			name:    "delete missing object",
			args:    map[string]interface{}{"action": "delete", "namespace": "bookinfo", "group": "networking.istio.io", "version": "v1", "kind": "VirtualService"},
			wantErr: "name is required",
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

// ---------------------------------------------------------------------------
// 2. Execute – write actions (create, patch, delete)
// ---------------------------------------------------------------------------

func TestExecute_CreateConfirmed(t *testing.T) {
	businessLayer, conf := setupTest(t)
	r := reqWithAuth()

	args := baseWriteArgs("create")
	args["data"] = `{"metadata":{"name":"reviews","namespace":"bookinfo"},"spec":{"hosts":["reviews"]}}`

	res, status := Execute(r, args, businessLayer, conf)
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

	res, status := Execute(r, args, businessLayer, conf)
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

	res, status := Execute(r, args, businessLayer, conf)
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

	res, status := Execute(r, args, businessLayer, conf)
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

	res, status := Execute(r, args, businessLayer, conf)
	assert.Equal(t, http.StatusOK, status)
	assert.Nil(t, res)
}

func TestExecute_DeletePreview(t *testing.T) {
	businessLayer, conf := setupTest(t, existingVS())
	r := reqWithAuth()

	args := baseWriteArgs("delete")
	args["confirmed"] = false

	res, status := Execute(r, args, businessLayer, conf)
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

	res, status := Execute(r, args, businessLayer, conf)
	assert.Equal(t, http.StatusBadRequest, status)
	assert.Contains(t, res.(error).Error(), "manage_istio_config_read")
}

func TestExecute_RejectsGetAction(t *testing.T) {
	businessLayer, conf := setupTest(t)
	r := reqWithAuth()

	args := map[string]interface{}{
		"action":    "get",
		"confirmed": true,
	}

	res, status := Execute(r, args, businessLayer, conf)
	assert.Equal(t, http.StatusBadRequest, status)
	assert.Contains(t, res.(error).Error(), "manage_istio_config_read")
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

	res, status := ExecuteReadOnly(r, args, businessLayer, conf)
	assert.Equal(t, http.StatusBadRequest, status)
	assert.Contains(t, res, "invalid action")
}

func TestExecuteReadOnly_ListSuccess(t *testing.T) {
	businessLayer, conf := setupTest(t, existingVS(), existingDR())
	r := reqWithAuth()

	args := map[string]interface{}{
		"action":    "list",
		"namespace": "bookinfo",
	}

	res, status := ExecuteReadOnly(r, args, businessLayer, conf)
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

	res, status := ExecuteReadOnly(r, args, businessLayer, conf)
	require.Equal(t, http.StatusOK, status)
	assert.NotNil(t, res)
}

// ---------------------------------------------------------------------------
// 5. Corner cases
// ---------------------------------------------------------------------------

func TestExecute_InvalidYAMLData(t *testing.T) {
	businessLayer, conf := setupTest(t)
	r := reqWithAuth()

	args := baseWriteArgs("create")
	args["data"] = `{invalid yaml:::}`

	res, status := Execute(r, args, businessLayer, conf)
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

	res, status := Execute(r, args, businessLayer, conf)
	assert.Equal(t, http.StatusBadRequest, status)
	resStr, ok := res.(string)
	require.True(t, ok)
	assert.Contains(t, resStr, "Object type not managed")
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

	res, status := ExecuteReadOnly(r, args, businessLayer, conf)
	assert.Equal(t, http.StatusBadRequest, status)
	resStr, ok := res.(string)
	require.True(t, ok)
	assert.Contains(t, resStr, "Object type not managed")
}

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

	res, status := ExecuteReadOnly(r, args, businessLayer, conf)
	assert.Equal(t, http.StatusBadRequest, status)
	resStr, ok := res.(string)
	require.True(t, ok)
	assert.Contains(t, resStr, "try version 'v1'")
}

func TestExecute_DeleteNonExistentResource(t *testing.T) {
	businessLayer, conf := setupTest(t)
	r := reqWithAuth()

	args := baseWriteArgs("delete")
	args["object"] = "does-not-exist"

	res, status := Execute(r, args, businessLayer, conf)
	// The business layer returns nil for not-found deletes (graceful handling).
	assert.Equal(t, http.StatusOK, status)
	assert.Nil(t, res)
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

	res, status := Execute(r, args, businessLayer, conf)
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

	res, status := Execute(r, args, businessLayer, conf)
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

	res, status := Execute(r, args, businessLayer, conf)
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

	res, status := Execute(r, args, businessLayer, conf)
	assert.Equal(t, http.StatusOK, status)
	assert.Nil(t, res)
}

func TestExecute_CreateMissingRequiredField(t *testing.T) {
	businessLayer, conf := setupTest(t)
	r := reqWithAuth()

	args := baseWriteArgs("create")
	// Missing "data" field
	delete(args, "data")

	res, status := Execute(r, args, businessLayer, conf)
	assert.Equal(t, http.StatusBadRequest, status)
	assert.Contains(t, res, "data is required")
}

func TestExecute_PatchMissingData(t *testing.T) {
	businessLayer, conf := setupTest(t, existingVS())
	r := reqWithAuth()

	args := baseWriteArgs("patch")
	// Missing "data" field
	delete(args, "data")

	res, status := Execute(r, args, businessLayer, conf)
	assert.Equal(t, http.StatusBadRequest, status)
	assert.Contains(t, res, "data is required")
}

func TestExecute_DeleteMissingObject(t *testing.T) {
	businessLayer, conf := setupTest(t)
	r := reqWithAuth()

	args := baseWriteArgs("delete")
	delete(args, "object")

	res, status := Execute(r, args, businessLayer, conf)
	assert.Equal(t, http.StatusBadRequest, status)
	assert.Contains(t, res, "name is required")
}

// ---------------------------------------------------------------------------
// 6. Preview action metadata tests
// ---------------------------------------------------------------------------

func TestCreateFileAction_Metadata(t *testing.T) {
	businessLayer, conf := setupTest(t, existingVS())

	args := map[string]interface{}{
		"action":    "patch",
		"namespace": "bookinfo",
		"group":     "networking.istio.io",
		"version":   "v1",
		"kind":      "VirtualService",
		"object":    "reviews",
		"cluster":   "east",
		"data":      `{"spec":{"hosts":["reviews"]}}`,
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
		"action":    "delete",
		"namespace": "bookinfo",
		"group":     "networking.istio.io",
		"version":   "v1",
		"kind":      "VirtualService",
		"object":    "reviews",
		"cluster":   "east",
		"data":      "",
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
	assert.Nil(t, res)
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
	// Business layer handles not-found gracefully by returning nil.
	assert.Equal(t, http.StatusOK, status)
	assert.Nil(t, res)
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

	res, status := Execute(r, args, businessLayer, conf)
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

	res, status := Execute(r, args, businessLayer, conf)
	assert.Equal(t, http.StatusOK, status)
	assert.Nil(t, res)
}

// ---------------------------------------------------------------------------
// 11. Data whitespace edge cases
// ---------------------------------------------------------------------------

func TestExecute_CreateWithWhitespaceOnlyData(t *testing.T) {
	businessLayer, conf := setupTest(t)
	r := reqWithAuth()

	args := baseWriteArgs("create")
	args["data"] = "   "

	res, status := Execute(r, args, businessLayer, conf)
	assert.Equal(t, http.StatusBadRequest, status)
	assert.Contains(t, res, "data is required")
}

func TestExecute_PatchWithWhitespaceOnlyData(t *testing.T) {
	businessLayer, conf := setupTest(t, existingVS())
	r := reqWithAuth()

	args := baseWriteArgs("patch")
	args["data"] = "\t\n  "

	res, status := Execute(r, args, businessLayer, conf)
	assert.Equal(t, http.StatusBadRequest, status)
	assert.Contains(t, res, "data is required")
}
