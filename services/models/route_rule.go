package models

import (
	"time"

	"github.com/kiali/kiali/kubernetes"
)

type RouteRules []RouteRule
type RouteRule struct {
	Name             string      `json:"name"`
	CreatedAt        string      `json:"created_at"`
	ResourceVersion  string      `json:"resource_version"`
	Destination      interface{} `json:"destination,omitempty"`
	Precedence       interface{} `json:"precedence,omitempty"`
	Match            interface{} `json:"match,omitempty"`
	Route            interface{} `json:"route,omitempty"`
	Redirect         interface{} `json:"redirect,omitempty"`
	Rewrite          interface{} `json:"rewrite,omitempty"`
	WebsocketUpgrade interface{} `json:"websocketUpgrade,omitempty"`
	HttpReqTimeout   interface{} `json:"httpReqTimeout,omitempty"`
	HttpReqRetries   interface{} `json:"httpReqRetries,omitempty"`
	HttpFault        interface{} `json:"httpFault,omitempty"`
	L4Fault          interface{} `json:"l4Fault,omitempty"`
	Mirror           interface{} `json:"mirror,omitempty"`
	CorsPolicy       interface{} `json:"corsPolicy,omitempty"`
	AppendHeaders    interface{} `json:"appendHeaders,omitempty"`
}

func (rules *RouteRules) Parse(routeRules []kubernetes.IstioObject) {
	for _, rr := range routeRules {
		routeRule := RouteRule{}
		routeRule.Parse(rr)
		*rules = append(*rules, routeRule)
	}
}

func (rule *RouteRule) Parse(routeRule kubernetes.IstioObject) {
	rule.Name = routeRule.GetObjectMeta().Name
	rule.CreatedAt = routeRule.GetObjectMeta().CreationTimestamp.Time.Format(time.RFC3339)
	rule.ResourceVersion = routeRule.GetObjectMeta().ResourceVersion
	rule.Destination = routeRule.GetSpec()["destination"]
	rule.Precedence = routeRule.GetSpec()["precedence"]
	rule.Match = routeRule.GetSpec()["match"]
	rule.Route = routeRule.GetSpec()["route"]
	rule.Redirect = routeRule.GetSpec()["redirect"]
	rule.Rewrite = routeRule.GetSpec()["rewrite"]
	rule.WebsocketUpgrade = routeRule.GetSpec()["websocketUpgrade"]
	rule.HttpReqTimeout = routeRule.GetSpec()["httpReqTimeout"]
	rule.HttpReqRetries = routeRule.GetSpec()["httpReqRetries"]
	rule.HttpFault = routeRule.GetSpec()["httpFault"]
	rule.L4Fault = routeRule.GetSpec()["l4Fault"]
	rule.Mirror = routeRule.GetSpec()["mirror"]
	rule.CorsPolicy = routeRule.GetSpec()["corsPolicy"]
	rule.AppendHeaders = routeRule.GetSpec()["appendHeaders"]
}
