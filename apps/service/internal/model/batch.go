package model

type BatchRequest struct {
	Pages     []Page     `json:"pages"`
	Groups    []Group    `json:"groups"`
	Captures  []Capture  `json:"captures"`
	Templates []Template `json:"templates"`
	Documents []Document `json:"documents"`
}

type BatchResponse struct {
	Pages     int `json:"pages"`
	Groups    int `json:"groups"`
	Captures  int `json:"captures"`
	Templates int `json:"templates"`
	Documents int `json:"documents"`
}
