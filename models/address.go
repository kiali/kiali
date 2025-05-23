package models

type Addresses []Address
type Address struct {
	Kind string `json:"kind"`
	Name string `json:"name"`
	IP   string `json:"ip"`
}
