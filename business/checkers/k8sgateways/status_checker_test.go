package k8sgateways

import (
	"testing"

	"github.com/stretchr/testify/assert"
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
	k8s_networking_v1 "sigs.k8s.io/gateway-api/apis/v1"

	"github.com/kiali/kiali/config"
	"github.com/kiali/kiali/models"
	"github.com/kiali/kiali/tests/data"
)

func TestCorrectK8sGatewaysStatus(t *testing.T) {
	conf := config.NewConfig()
	config.Set(conf)

	assert := assert.New(t)

	k8sgwObject := data.CreateEmptyK8sGateway("validgateway", "test")

	k8sgws := StatusChecker{k8sgwObject}

	check, isValid := k8sgws.Check()

	assert.True(isValid)
	assert.Empty(check)
}

func TestIncorrectK8sGatewaysStatus(t *testing.T) {
	conf := config.NewConfig()
	config.Set(conf)

	assert := assert.New(t)

	gwAddress := data.CreateGWAddress("IPAddress", "192.168.0.0")
	k8sgwObject := data.AddListenerToK8sGateway(data.CreateListener("test", "host.com.wrong", 11, "http"),
		data.CreateEmptyK8sGateway("validk8sgateway", "test"))
	k8sgwObject = data.AddGwAddressToK8sGateway(gwAddress, k8sgwObject)
	k8sgwObject = data.UpdateConditionWithError(k8sgwObject)

	k8sgws := StatusChecker{k8sgwObject}

	check, isValid := k8sgws.Check()

	assert.False(isValid)
	assert.NotEmpty(check)
	assert.Equal("Fake msg. GWAPI errors should be changed in the spec.", check[0].Message)
	assert.Equal(models.WarningSeverity, check[0].Severity)
}

func TestIncorrectK8sGatewaysAcceptedStatus(t *testing.T) {
	conf := config.NewConfig()
	config.Set(conf)

	assert := assert.New(t)

	k8sgwObject := data.CreateEmptyK8sGateway("validk8sgateway", "test")
	k8sgwObject.Status.Conditions = append(k8sgwObject.Status.Conditions,
		metav1.Condition{Type: "Accepted", Status: "False", Reason: "Invalid", Message: "Not accepted"})

	k8sgws := StatusChecker{k8sgwObject}

	check, isValid := k8sgws.Check()

	assert.False(isValid)
	assert.Len(check, 1)
	assert.Equal("Not accepted. GWAPI errors should be changed in the spec.", check[0].Message)
	assert.Equal(models.WarningSeverity, check[0].Severity)
}

func TestIncorrectK8sGatewaysProgrammedStatus(t *testing.T) {
	conf := config.NewConfig()
	config.Set(conf)

	assert := assert.New(t)

	k8sgwObject := data.CreateEmptyK8sGateway("validk8sgateway", "test")
	k8sgwObject.Status.Conditions = append(k8sgwObject.Status.Conditions,
		metav1.Condition{Type: "Programmed", Status: "False", Reason: "Invalid", Message: "Not programmed"})

	k8sgws := StatusChecker{k8sgwObject}

	check, isValid := k8sgws.Check()

	assert.False(isValid)
	assert.Len(check, 1)
	assert.Equal("Not programmed. GWAPI errors should be changed in the spec.", check[0].Message)
}

func TestK8sGatewaysProgrammedPendingNotFlagged(t *testing.T) {
	conf := config.NewConfig()
	config.Set(conf)

	assert := assert.New(t)

	k8sgwObject := data.CreateEmptyK8sGateway("validk8sgateway", "test")
	k8sgwObject.Status.Conditions = append(k8sgwObject.Status.Conditions,
		metav1.Condition{Type: "Programmed", Status: "False", Reason: "Pending", Message: "Waiting for controller"})

	k8sgws := StatusChecker{k8sgwObject}

	check, isValid := k8sgws.Check()

	assert.True(isValid)
	assert.Empty(check)
}

func TestK8sGatewaysAcceptedListenersNotValidNotFlagged(t *testing.T) {
	conf := config.NewConfig()
	config.Set(conf)

	assert := assert.New(t)

	k8sgwObject := data.CreateEmptyK8sGateway("validk8sgateway", "test")
	k8sgwObject.Status.Conditions = append(k8sgwObject.Status.Conditions,
		metav1.Condition{Type: "Accepted", Status: "False", Reason: "ListenersNotValid", Message: "Listeners have no routes"})

	k8sgws := StatusChecker{k8sgwObject}

	check, isValid := k8sgws.Check()

	assert.True(isValid)
	assert.Empty(check)
}

func TestK8sGatewayListenerAcceptedPendingNotFlagged(t *testing.T) {
	conf := config.NewConfig()
	config.Set(conf)

	assert := assert.New(t)

	k8sgwObject := data.AddListenerToK8sGateway(data.CreateListener("http", "example.com", 80, "HTTP"),
		data.CreateEmptyK8sGateway("validk8sgateway", "test"))
	k8sgwObject.Status.Listeners = []k8s_networking_v1.ListenerStatus{
		{
			Conditions: []metav1.Condition{
				{Type: "Accepted", Status: "False", Reason: "Pending", Message: "Waiting for controller"},
			},
		},
	}

	k8sgws := StatusChecker{k8sgwObject}

	check, isValid := k8sgws.Check()

	assert.True(isValid)
	assert.Empty(check)
}

func TestK8sGatewaysProgrammedAddressPendingMessageNotFlagged(t *testing.T) {
	conf := config.NewConfig()
	config.Set(conf)

	assert := assert.New(t)

	k8sgwObject := data.CreateEmptyK8sGateway("validk8sgateway", "test")
	k8sgwObject.Status.Conditions = append(k8sgwObject.Status.Conditions,
		metav1.Condition{
			Type:    "Programmed",
			Status:  "False",
			Reason:  "AddressNotAssigned",
			Message: "Assigned to service(s) gw-istio.bookinfo.svc.cluster.local:80, but failed to assign to all requested addresses: address pending for hostname \"gw-istio.bookinfo.svc.cluster.local\"",
		})

	k8sgws := StatusChecker{k8sgwObject}

	check, isValid := k8sgws.Check()

	assert.True(isValid)
	assert.Empty(check)
}

func TestIncorrectK8sGatewaysProgrammedNoResourcesStatus(t *testing.T) {
	conf := config.NewConfig()
	config.Set(conf)

	assert := assert.New(t)

	k8sgwObject := data.CreateEmptyK8sGateway("validk8sgateway", "test")
	k8sgwObject.Status.Conditions = append(k8sgwObject.Status.Conditions,
		metav1.Condition{Type: "Programmed", Status: "False", Reason: "NoResources", Message: "No gateway pods"})

	k8sgws := StatusChecker{k8sgwObject}

	check, isValid := k8sgws.Check()

	assert.False(isValid)
	assert.Len(check, 1)
	assert.Equal("No gateway pods. GWAPI errors should be changed in the spec.", check[0].Message)
}

func TestIncorrectK8sGatewaysProgrammedAddressNotAssignedStatus(t *testing.T) {
	conf := config.NewConfig()
	config.Set(conf)

	assert := assert.New(t)

	k8sgwObject := data.CreateEmptyK8sGateway("validk8sgateway", "test")
	k8sgwObject.Status.Conditions = append(k8sgwObject.Status.Conditions,
		metav1.Condition{Type: "Programmed", Status: "False", Reason: "AddressNotAssigned", Message: "demo Programmed=False"})

	k8sgws := StatusChecker{k8sgwObject}

	check, isValid := k8sgws.Check()

	assert.False(isValid)
	assert.Len(check, 1)
	assert.Equal("demo Programmed=False. GWAPI errors should be changed in the spec.", check[0].Message)
	assert.Equal(models.WarningSeverity, check[0].Severity)
}

func TestIncorrectK8sGatewaysScheduledStatus(t *testing.T) {
	conf := config.NewConfig()
	config.Set(conf)

	assert := assert.New(t)

	k8sgwObject := data.CreateEmptyK8sGateway("validk8sgateway", "test")
	k8sgwObject.Status.Conditions = append(k8sgwObject.Status.Conditions,
		metav1.Condition{Type: "Scheduled", Status: "False", Reason: "Invalid", Message: "Not scheduled"})

	k8sgws := StatusChecker{k8sgwObject}

	check, isValid := k8sgws.Check()

	assert.False(isValid)
	assert.Len(check, 1)
	assert.Equal("Not scheduled. GWAPI errors should be changed in the spec.", check[0].Message)
}

func TestIncorrectK8sGatewayListenerDetachedStatus(t *testing.T) {
	conf := config.NewConfig()
	config.Set(conf)

	assert := assert.New(t)

	k8sgwObject := data.AddListenerToK8sGateway(data.CreateListener("http", "example.com", 80, "HTTP"),
		data.CreateEmptyK8sGateway("validk8sgateway", "test"))
	k8sgwObject.Status.Listeners = []k8s_networking_v1.ListenerStatus{
		{
			Conditions: []metav1.Condition{
				{Type: "Detached", Status: "True", Reason: "Invalid", Message: "Listener detached"},
			},
		},
	}

	k8sgws := StatusChecker{k8sgwObject}

	check, isValid := k8sgws.Check()

	assert.False(isValid)
	assert.Len(check, 1)
	assert.Equal("Listener detached. GWAPI errors should be changed in the spec.", check[0].Message)
}

func TestIncorrectK8sGatewayListenerProgrammedStatus(t *testing.T) {
	conf := config.NewConfig()
	config.Set(conf)

	assert := assert.New(t)

	k8sgwObject := data.AddListenerToK8sGateway(data.CreateListener("http", "example.com", 80, "HTTP"),
		data.CreateEmptyK8sGateway("validk8sgateway", "test"))
	k8sgwObject.Status.Listeners = []k8s_networking_v1.ListenerStatus{
		{
			Conditions: []metav1.Condition{
				{Type: "Programmed", Status: "False", Reason: "Invalid", Message: "Listener not programmed"},
			},
		},
	}

	k8sgws := StatusChecker{k8sgwObject}

	check, isValid := k8sgws.Check()

	assert.False(isValid)
	assert.Len(check, 1)
	assert.Equal("Listener not programmed. GWAPI errors should be changed in the spec.", check[0].Message)
}

func TestK8sGatewayListenerProgrammedPendingNotFlagged(t *testing.T) {
	conf := config.NewConfig()
	config.Set(conf)

	assert := assert.New(t)

	k8sgwObject := data.AddListenerToK8sGateway(data.CreateListener("http", "example.com", 80, "HTTP"),
		data.CreateEmptyK8sGateway("validk8sgateway", "test"))
	k8sgwObject.Status.Listeners = []k8s_networking_v1.ListenerStatus{
		{
			Conditions: []metav1.Condition{
				{Type: "Programmed", Status: "False", Reason: "Pending", Message: "Waiting for routes"},
			},
		},
	}

	k8sgws := StatusChecker{k8sgwObject}

	check, isValid := k8sgws.Check()

	assert.True(isValid)
	assert.Empty(check)
}
