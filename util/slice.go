package util

func InSlice(array []string, value string) bool {
	for _, v := range array {
		if v == value {
			return true
		}
	}
	return false
}
