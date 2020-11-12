package models

import (
	"testing"

	"github.com/stretchr/testify/assert"

	"github.com/kiali/kiali/config"
)

func TestAdditionalDetails(t *testing.T) {
	assert := assert.New(t)
	conf := config.NewConfig()
	conf.AdditionalDisplayDetails = []config.AdditionalDisplayItem{
		{
			Annotation: "my-annotation-1",
			Title:      "Title 1",
		},
		{
			Annotation:     "my-annotation-2",
			Title:          "Title 2",
			IconAnnotation: "my-icon-annotation-2",
		},
		{
			Annotation:     "my-annotation-3",
			Title:          "Title 3",
			IconAnnotation: "my-icon-annotation-3",
		},
	}

	annotations := map[string]string{
		"my-annotation-1":      "value-1",
		"my-annotation-2":      "value-2",
		"my-icon-annotation-2": "icon-2",
		"my-annotation-3":      "value-3",
		"my-icon-annotation-3": "icon-3",
		"my-annotation-4":      "value-4",
	}

	firstIcon := GetFirstAdditionalIcon(conf, annotations)
	assert.NotNil(firstIcon)
	assert.Equal("Title 2", firstIcon.Title)
	assert.Equal("icon-2", firstIcon.Icon)
	assert.Equal("value-2", firstIcon.Value)

	details := GetAdditionalDetails(conf, annotations)
	assert.Len(details, 3)
	assert.Equal("Title 1", details[0].Title)
	assert.Empty(details[0].Icon)
	assert.Equal("value-1", details[0].Value)
	assert.Equal("Title 2", details[1].Title)
	assert.Equal("icon-2", details[1].Icon)
	assert.Equal("value-2", details[1].Value)
	assert.Equal("Title 3", details[2].Title)
	assert.Equal("icon-3", details[2].Icon)
	assert.Equal("value-3", details[2].Value)
}

func TestEmptyAdditionalDetails(t *testing.T) {
	assert := assert.New(t)
	conf := config.NewConfig()
	conf.AdditionalDisplayDetails = []config.AdditionalDisplayItem{
		{
			Annotation: "my-annotation-1",
			Title:      "Title 1",
		},
		{
			Annotation:     "my-annotation-2",
			Title:          "Title 2",
			IconAnnotation: "my-icon-annotation-2",
		},
		{
			Annotation:     "my-annotation-3",
			Title:          "Title 3",
			IconAnnotation: "my-icon-annotation-3",
		},
	}

	annotations := map[string]string{}

	firstIcon := GetFirstAdditionalIcon(conf, annotations)
	assert.Nil(firstIcon)

	details := GetAdditionalDetails(conf, annotations)
	assert.Empty(details)
}
