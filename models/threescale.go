package models

import "github.com/kiali/kiali/kubernetes"

const (
	BadThreeScaleHandlerJson = "bad ThreeScaleHandler JSON"
	BadThreeScaleRuleJson    = "bad ThreeScaleHandler JSON"
)

// ThreeScaleInfo shows if 3scale adapter is enabled in cluster and if user has permissions on adapter's configuration
type ThreeScaleInfo struct {
	Enabled     bool                `json:"enabled"`
	Permissions ResourcePermissions `json:"permissions"`
}

// ThreeScaleHAndler represents the minimal info that a user needs to know from the UI to link a service with 3Scale site
type ThreeScaleHandler struct {
	Name        string `json:"name"`
	ServiceId   string `json:"serviceId"`
	SystemUrl   string `json:"systemUrl"`
	AccessToken string `json:"accessToken"`
}

type ThreeScaleHandlers []ThreeScaleHandler

type ThreeScaleServiceRule struct {
	ServiceName           string `json:"serviceName"`
	ServiceNamespace      string `json:"serviceNamespace"`
	ThreeScaleHandlerName string `json:"threeScaleHandlerName"`
}

func CastThreeScaleHandlers(handlers []kubernetes.IstioObject) ThreeScaleHandlers {
	threeScaleHandlers := make([]ThreeScaleHandler, len(handlers))
	for i, handler := range handlers {
		threeScaleHandlers[i] = CastThreeScaleHandler(handler)
	}
	return threeScaleHandlers
}

func CastThreeScaleHandler(handler kubernetes.IstioObject) ThreeScaleHandler {
	threeScaleHandler := ThreeScaleHandler{}
	threeScaleHandler.Name = handler.GetObjectMeta().Name
	if params, paramsPresent := handler.GetSpec()["params"]; paramsPresent {
		if paramsMap, paramsCasted := params.(map[string]interface{}); paramsCasted {
			if serviceId, serviceIdPresent := paramsMap["service_id"]; serviceIdPresent {
				if serviceIdValue, serviceIdCasted := serviceId.(string); serviceIdCasted {
					threeScaleHandler.ServiceId = serviceIdValue
				}
			}
			if systemUrl, systemUrlPresent := paramsMap["system_url"]; systemUrlPresent {
				if systemUrlValue, systemUrlCasted := systemUrl.(string); systemUrlCasted {
					threeScaleHandler.SystemUrl = systemUrlValue
				}
			}
			if accessToken, accessTokenPresent := paramsMap["access_token"]; accessTokenPresent {
				if accessTokenValue, accessTokenCasted := accessToken.(string); accessTokenCasted {
					threeScaleHandler.AccessToken = accessTokenValue
				}
			}
		}
	}
	return threeScaleHandler
}
