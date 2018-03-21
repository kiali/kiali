package models

import (
	"github.com/kiali/swscore/kubernetes"
)

type RouteRules []RouteRule
type RouteRule struct {
	Name        string      `json:"name"`
	Destination interface{} `json:"destination"`
	Precedence  interface{} `json:"precedence"`
	Route       interface{} `json:"route"`
	Match       interface{} `json:"match"`
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
	rule.Route = routeRule.GetSpec()["route"]
	rule.Match = routeRule.GetSpec()["match"]
}
