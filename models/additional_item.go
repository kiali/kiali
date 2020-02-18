package models

import "github.com/kiali/kiali/config"

type AdditionalItem struct {
	Title string `json:"title"`
	Value string `json:"value"`
	Icon  string `json:"icon"`
}

func GetAdditionalDetails(conf *config.Config, annotations map[string]string) []AdditionalItem {
	items := []AdditionalItem{}
	for _, itemConfig := range conf.AdditionalDisplayDetails {
		if itemConfig.Annotation != "" {
			var icon string
			if itemConfig.IconAnnotation != "" {
				icon = annotations[itemConfig.IconAnnotation]
			}
			if value, ok := annotations[itemConfig.Annotation]; ok {
				items = append(items, AdditionalItem{
					Title: itemConfig.Title,
					Value: value,
					Icon:  icon,
				})
			}
		}
	}
	return items
}

func GetFirstAdditionalIcon(conf *config.Config, annotations map[string]string) string {
	for _, itemConfig := range conf.AdditionalDisplayDetails {
		if itemConfig.IconAnnotation != "" {
			if icon, ok := annotations[itemConfig.IconAnnotation]; ok {
				return icon
			}
		}
	}
	return ""
}
