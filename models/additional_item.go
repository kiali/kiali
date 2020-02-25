package models

import "github.com/kiali/kiali/config"

type AdditionalItem struct {
	Title string `json:"title"`
	Value string `json:"value"`
	Icon  string `json:"icon"`
}

func getMatchingDetail(itemConfig config.AdditionalDisplayItem, annotations map[string]string) *AdditionalItem {
	if itemConfig.Annotation != "" {
		var icon string
		if itemConfig.IconAnnotation != "" {
			icon = annotations[itemConfig.IconAnnotation]
		}
		if value, ok := annotations[itemConfig.Annotation]; ok {
			return &AdditionalItem{
				Title: itemConfig.Title,
				Value: value,
				Icon:  icon,
			}
		}
	}
	return nil
}

func GetAdditionalDetails(conf *config.Config, annotations map[string]string) []AdditionalItem {
	items := []AdditionalItem{}
	for _, itemConfig := range conf.AdditionalDisplayDetails {
		if detail := getMatchingDetail(itemConfig, annotations); detail != nil {
			items = append(items, *detail)
		}
	}
	return items
}

func GetFirstAdditionalIcon(conf *config.Config, annotations map[string]string) *AdditionalItem {
	for _, itemConfig := range conf.AdditionalDisplayDetails {
		if detail := getMatchingDetail(itemConfig, annotations); detail != nil && detail.Icon != "" {
			return detail
		}
	}
	return nil
}
