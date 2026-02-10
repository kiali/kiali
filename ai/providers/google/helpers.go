package google_provider

import "google.golang.org/genai"

func mapToGenAISchema(schemaMap map[string]interface{}) *genai.Schema {
	if schemaMap == nil {
		return nil
	}

	// 1. Identify Type
	typeStr, _ := schemaMap["type"].(string)
	s := &genai.Schema{
		Type:        getGenAIType(typeStr),
		Description: getString(schemaMap, "description"),
		Nullable:    getBool(schemaMap, "nullable"),
	}

	// 2. Handle Objects (Properties)
	if props, ok := schemaMap["properties"].(map[string]interface{}); ok {
		s.Properties = make(map[string]*genai.Schema)
		for k, v := range props {
			if vMap, ok := v.(map[string]interface{}); ok {
				s.Properties[k] = mapToGenAISchema(vMap)
			}
		}
	}

	// 3. Handle Arrays (Items)
	if items, ok := schemaMap["items"].(map[string]interface{}); ok {
		s.Items = mapToGenAISchema(items)
	}

	// 4. Handle Required Fields
	if req, ok := schemaMap["required"].([]interface{}); ok {
		for _, r := range req {
			reqName, ok := r.(string)
			if !ok || reqName == "" {
				continue
			}
			if len(s.Properties) > 0 {
				if _, exists := s.Properties[reqName]; !exists {
					continue
				}
			}
			s.Required = append(s.Required, reqName)
		}
	}

	// 5. Handle Enums
	if enums, ok := schemaMap["enum"].([]interface{}); ok {
		for _, e := range enums {
			if strVal, ok := e.(string); ok {
				if strVal == "" {
					continue
				}
				s.Enum = append(s.Enum, strVal)
			}
		}
	}

	return s
}

func getGenAIType(t string) genai.Type {
	switch t {
	case "string":
		return genai.TypeString
	case "number":
		return genai.TypeNumber
	case "integer":
		return genai.TypeInteger
	case "boolean":
		return genai.TypeBoolean
	case "array":
		return genai.TypeArray
	case "object":
		return genai.TypeObject
	default:
		return genai.TypeString // Default fallback
	}
}

func getString(m map[string]interface{}, k string) string {
	if v, ok := m[k].(string); ok {
		return v
	}
	return ""
}
func getBool(m map[string]interface{}, k string) *bool {
	if v, ok := m[k].(bool); ok {
		return &v
	}
	return nil
}
