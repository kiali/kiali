package objx_test

import (
	"net/url"
	"testing"

	"github.com/stretchr/objx"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

func TestConversionJSON(t *testing.T) {
	jsonString := `{"name":"Mat"}`
	o := objx.MustFromJSON(jsonString)

	result, err := o.JSON()

	require.NoError(t, err)
	assert.Equal(t, jsonString, result)
	assert.Equal(t, jsonString, o.MustJSON())
}

func TestConversionJSONWithError(t *testing.T) {
	o := objx.MSI()
	o["test"] = func() {}

	assert.Panics(t, func() {
		o.MustJSON()
	})

	_, err := o.JSON()

	assert.Error(t, err)
}

func TestConversionBase64(t *testing.T) {
	o := objx.Map{"name": "Mat"}

	result, err := o.Base64()

	require.NoError(t, err)
	assert.Equal(t, "eyJuYW1lIjoiTWF0In0=", result)
	assert.Equal(t, "eyJuYW1lIjoiTWF0In0=", o.MustBase64())
}

func TestConversionBase64WithError(t *testing.T) {
	o := objx.MSI()
	o["test"] = func() {}

	assert.Panics(t, func() {
		o.MustBase64()
	})

	_, err := o.Base64()

	assert.Error(t, err)
}

func TestConversionSignedBase64(t *testing.T) {
	o := objx.Map{"name": "Mat"}

	result, err := o.SignedBase64("key")

	require.NoError(t, err)
	assert.Equal(t, "eyJuYW1lIjoiTWF0In0=_67ee82916f90b2c0d68c903266e8998c9ef0c3d6", result)
	assert.Equal(t, "eyJuYW1lIjoiTWF0In0=_67ee82916f90b2c0d68c903266e8998c9ef0c3d6", o.MustSignedBase64("key"))
}

func TestConversionSignedBase64WithError(t *testing.T) {
	o := objx.MSI()
	o["test"] = func() {}

	assert.Panics(t, func() {
		o.MustSignedBase64("key")
	})

	_, err := o.SignedBase64("key")

	assert.Error(t, err)
}

func TestConversionURLValues(t *testing.T) {
	m := getURLQueryMap()
	u := m.URLValues()

	assert.Equal(t, url.Values{
		"abc":                []string{"123"},
		"name":               []string{"Mat"},
		"data[age]":          []string{"30"},
		"data[height]":       []string{"162"},
		"data[arr][]":        []string{"1", "2"},
		"stats[]":            []string{"1", "2"},
		"bools[]":            []string{"true", "false"},
		"mapSlice[][age]":    []string{"40"},
		"mapSlice[][height]": []string{"152"},
	}, u)
}

func TestConversionURLQuery(t *testing.T) {
	m := getURLQueryMap()
	u, err := m.URLQuery()

	assert.Nil(t, err)
	require.NotNil(t, u)

	ue, err := url.QueryUnescape(u)
	assert.Nil(t, err)
	require.NotNil(t, ue)

	assert.Equal(t, "abc=123&bools[]=true&bools[]=false&data[age]=30&data[arr][]=1&data[arr][]=2&data[height]=162&mapSlice[][age]=40&mapSlice[][height]=152&name=Mat&stats[]=1&stats[]=2", ue)
}

func TestConversionURLQueryNoSliceKeySuffix(t *testing.T) {
	m := getURLQueryMap()
	objx.URLValuesSliceKeySuffix = ""
	u, err := m.URLQuery()

	assert.Nil(t, err)
	require.NotNil(t, u)

	ue, err := url.QueryUnescape(u)
	assert.Nil(t, err)
	require.NotNil(t, ue)

	assert.Equal(t, "abc=123&bools=true&bools=false&data[age]=30&data[arr]=1&data[arr]=2&data[height]=162&mapSlice[age]=40&mapSlice[height]=152&name=Mat&stats=1&stats=2", ue)
}

func getURLQueryMap() objx.Map {
	return objx.Map{
		"abc":      123,
		"name":     "Mat",
		"data":     objx.Map{"age": 30, "height": 162, "arr": []int{1, 2}},
		"mapSlice": []objx.Map{{"age": 40}, {"height": 152}},
		"stats":    []string{"1", "2"},
		"bools":    []bool{true, false},
	}
}
