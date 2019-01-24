package main

import (
	"encoding/base64"
	"fmt"
	"net/http"
	"os"
	"strconv"
	"time"

	client "github.com/influxdata/influxdb1-client/v2"
	uuid "github.com/satori/go.uuid"
	vegeta "github.com/tsenart/vegeta/lib"
)

func main() {
	session := os.Getenv("SESSION_ID")
	routeEnv := os.Getenv("ROUTE")
	durationEnv, _ := strconv.Atoi(os.Getenv("DURATION"))
	rateEnv, _ := strconv.Atoi(os.Getenv("RATE"))
	usernameEnv := os.Getenv("KIALI_USERNAME")
	passwordEnv := os.Getenv("KIALI_PASSWORD")

	rate := vegeta.Rate{Freq: rateEnv, Per: time.Second}
	duration := time.Duration(durationEnv) * time.Second

	pod := uuid.Must(uuid.NewV4()).String()

	auth := usernameEnv + ":" + passwordEnv

	header := make(http.Header)
	header.Add("Authorization", "Basic "+base64.StdEncoding.EncodeToString([]byte(auth)))

	targeter := vegeta.NewStaticTargeter(vegeta.Target{
		Method: "GET",
		URL:    routeEnv,
		Header: header,
	})

	attacker := vegeta.NewAttacker()
	for res := range attacker.Attack(targeter, rate, duration, pod) {
		writeVegetaResultInfluxDatabase(res, pod, session, routeEnv)
	}

}

func writeVegetaResultInfluxDatabase(res *vegeta.Result, pod string, session string, routeEnv string) {

	c, _ := client.NewHTTPClient(client.HTTPConfig{
		Addr:     os.Getenv("INFLUX_ADDRESS"),
		Username: os.Getenv("INFLUX_USERNAME"),
		Password: os.Getenv("INFLUX_PASSWORD"),
	})

	batchpoint, _ := client.NewBatchPoints(client.BatchPointsConfig{
		Database:  "windsock",
		Precision: "ms",
	})

	tags := map[string]string{
		"session":         session,
		"sequential_code": strconv.Itoa(int(res.Seq)),
		"route":           routeEnv,
		"response_code":   strconv.Itoa(int(res.Code)),
		"pod":             pod,
	}

	fields := map[string]interface{}{
		"error":         res.Error,
		"body":          string(res.Body[:]),
		"response_size": int64(res.BytesIn),
		"latency":       int64(res.Latency / time.Millisecond),
	}

	pt, _ := client.NewPoint("requests", tags, fields, res.Timestamp)
	batchpoint.AddPoint(pt)

	err := c.Write(batchpoint)

	if err != nil {
		fmt.Printf("%v \n", err)
	} else {
		fmt.Printf("%v \n", pt.String())
	}

	//
}
