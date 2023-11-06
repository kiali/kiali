package util

func RemoveNilValues(root interface{}) {
	if mRoot, isMap := root.(map[string]interface{}); isMap {
		for k, v := range mRoot {
			if v == nil {
				delete(mRoot, k)
			}
			if leaf, isLeafMap := v.(map[string]interface{}); isLeafMap {
				RemoveNilValues(leaf)
			}
		}
	}
}

func CopyStringMap(originalMap map[string]string) map[string]string {
	copyMap := make(map[string]string)

	if len(originalMap) == 0 {
		return copyMap
	}

	for key, value := range originalMap {
		copyMap[key] = value
	}

	return copyMap
}
