package models

import (
	"errors"
	"fmt"

	"github.com/prometheus/common/model"

	"github.com/kiali/kiali/config"
	"github.com/kiali/kiali/models/threshold"
)

type Thresholds []Threshold

// Customize Thresholds error rates
type Threshold struct {
	Percent int    `json:"percent"`
	Rule    string `json:"rule"`
	Alert   string `json:"alert"`
}

func addParse(th config.ThresholdCheck, sample *model.Vector) (Threshold, error) {
	newTh := Threshold{}
	error := newTh.Parse(th, sample)
	if error == nil {
		return newTh, nil
	}
	return Threshold{}, error
}

func (in *Thresholds) Parse(ths []config.ThresholdCheck, inbound *model.Vector, outbound *model.Vector) {
	for _, th := range ths {
		if th.RequestType == "both" || th.RequestType == "inbound" {
			thParsed, err := addParse(th, inbound)
			if err == nil {
				*in = append(*in, thParsed)
			}
		}
		if th.RequestType == "both" || th.RequestType == "outbound" {
			thParsed, err := addParse(th, outbound)
			if err == nil {
				*in = append(*in, thParsed)
			}
		}
	}
}

func (in *Threshold) Parse(th config.ThresholdCheck, sample *model.Vector) error {
	count, total, err := threshold.CountBy(sample, th)

	if err != nil {
		return errors.New("Not Alert")
	}
	var calculation = (count * 100 / total)
	err, op, percent := threshold.CheckRule(th.Rule)
	if err != nil {
		return errors.New("Not Alert")
	}
	if threshold.Compare(calculation, op, percent) {
		in.Alert = th.Alert
		in.Percent = count * 100 / total
		in.Rule = fmt.Sprintf("[%s][%s] Alert requests where %s are %d%% , rule defined %s", th.Alert, th.RequestType, th.Expression, calculation, th.Rule)
		return nil
	}

	return errors.New("Not Alert")
}
