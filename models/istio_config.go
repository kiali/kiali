package models

import (
	networking_v1alpha3 "istio.io/client-go/pkg/apis/networking/v1alpha3"
	security_v1beta "istio.io/client-go/pkg/apis/security/v1beta1"
)

// IstioConfigList istioConfigList
//
// This type is used for returning a response of IstioConfigList
//
// swagger:model IstioConfigList
type IstioConfigList struct {
	// The namespace of istioConfiglist
	//
	// required: true
	Namespace Namespace `json:"namespace"`

	DestinationRules []networking_v1alpha3.DestinationRule `json:"destinationRules"`
	EnvoyFilters     []networking_v1alpha3.EnvoyFilter     `json:"envoyFilters"`
	Gateways         []networking_v1alpha3.Gateway         `json:"gateways"`
	ServiceEntries   []networking_v1alpha3.ServiceEntry    `json:"serviceEntries"`
	Sidecars         []networking_v1alpha3.Sidecar         `json:"sidecars"`
	VirtualServices  []networking_v1alpha3.VirtualService  `json:"virtualServices"`
	WorkloadEntries  []networking_v1alpha3.WorkloadEntry   `json:"workloadEntries"`
	WorkloadGroups   []networking_v1alpha3.WorkloadGroup   `json:"workloadGroups"`

	AuthorizationPolicies  []security_v1beta.AuthorizationPolicy   `json:"authorizationPolicies"`
	PeerAuthentications    []security_v1beta.PeerAuthentication    `json:"peerAuthentications"`
	RequestAuthentications []security_v1beta.RequestAuthentication `json:"requestAuthentications"`

	IstioValidations IstioValidations `json:"validations"`
}

type IstioConfigDetails struct {
	Namespace  Namespace `json:"namespace"`
	ObjectType string    `json:"objectType"`

	DestinationRule *networking_v1alpha3.DestinationRule `json:"destinationRule"`
	EnvoyFilter     *networking_v1alpha3.EnvoyFilter     `json:"envoyFilter"`
	Gateway         *networking_v1alpha3.Gateway         `json:"gateway"`
	ServiceEntry    *networking_v1alpha3.ServiceEntry    `json:"serviceEntry"`
	Sidecar         *networking_v1alpha3.Sidecar         `json:"sidecar"`
	VirtualService  *networking_v1alpha3.VirtualService  `json:"virtualService"`
	WorkloadEntry   *networking_v1alpha3.WorkloadEntry   `json:"workloadEntry"`
	WorkloadGroup   *networking_v1alpha3.WorkloadGroup   `json:"workloadGroup"`

	AuthorizationPolicy   *security_v1beta.AuthorizationPolicy   `json:"authorizationPolicy"`
	PeerAuthentication    *security_v1beta.PeerAuthentication    `json:"peerAuthentication"`
	RequestAuthentication *security_v1beta.RequestAuthentication `json:"requestAuthentication"`

	Permissions     ResourcePermissions `json:"permissions"`
	IstioValidation *IstioValidation    `json:"validation"`
	IstioReferences *IstioReferences    `json:"references"`
}

// ResourcePermissions holds permission flags for an object type
// True means allowed.
type ResourcePermissions struct {
	Create bool `json:"create"`
	Update bool `json:"update"`
	Delete bool `json:"delete"`
}

// ResourcesPermissions holds a map of permission flags per resource
type ResourcesPermissions map[string]*ResourcePermissions

// IstioConfigPermissions holds a map of ResourcesPermissions per namespace
type IstioConfigPermissions map[string]*ResourcesPermissions
