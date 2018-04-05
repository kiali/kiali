package models

import (
	"github.com/kiali/kiali/kubernetes"
)

type RouteRules []RouteRule
type RouteRule struct {
	Name             string      `json:"name"`
	Destination      interface{} `json:"destination"`
	Precedence       interface{} `json:"precedence"`
	Match            interface{} `json:"match"`
	Route            interface{} `json:"route"`
	Redirect         interface{} `json:"redirect"`
	Rewrite          interface{} `json:"rewrite"`
	WebsocketUpgrade interface{} `json:"websocketUpgrade"`
	HttpReqTimeout   interface{} `json:"httpReqTimeout"`
	HttpReqRetries   interface{} `json:"httpReqRetries"`
	HttpFault        interface{} `json:"httpFault"`
	L4Fault          interface{} `json:"l4Fault"`
	Mirror           interface{} `json:"mirror"`
	CorsPolicy       interface{} `json:"corsPolicy"`
	AppendHeaders    interface{} `json:"appendHeaders"`
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
