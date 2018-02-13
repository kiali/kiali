package models

type Service struct {
	Id        int    `json:"id"`
	Name      string `json:"name"`
	Namespace string `json:"namespace"`
}
