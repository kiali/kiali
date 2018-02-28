package models

import (
	"github.com/swift-sunshine/swscore/kubernetes"
)

type RouteRules []RouteRule
type RouteRule struct {
	Destination interface{} `json:"destination"`
	Precedence  interface{} `json:"precedence"`
	Route       interface{} `json:"route"`
}

func (rules *RouteRules) Parse(routeRules []*kubernetes.RouteRule) {
	for _, rr := range routeRules {
		routeRule := RouteRule{}
		routeRule.Parse(rr)
		*rules = append(*rules, routeRule)
	}
}

func (rule *RouteRule) Parse(routeRule *kubernetes.RouteRule) {
	rule.Destination = routeRule.Spec["destination"]
	rule.Precedence = routeRule.Spec["precedence"]
	rule.Route = routeRule.Spec["route"]
}
