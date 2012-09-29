package main

import (
	"bytes"
	"encoding/json"
	"flag"
	"io/ioutil"
	"log"
	"math/rand"
	"net/http"
	"net/url"
	"os"
	"strconv"
	"strings"
	"time"

	. "github.com/araddon/gou"
)

/* 
go clean && go build

./datagen -ct 1000 -persec 10  -file demo.json

# spread 1000 events over 3600 seconds (1 hour)
./datagen -ct 1000 -persec 10  -t 3600 -file demo.json

# spread 10000 events over 1 day
./datagen -ct 10000 -persec 10  -t 86400 -file demo.json

./datagen -ct 10000 -persec 20  -t 452000 -file si.json
*/

var (
	maxCt     int
	perSec    int
	timeFrame int
	quiet     bool
	file      string
	dataGen   *DataGen
)

func init() {
	flag.IntVar(&maxCt, "ct", 10, "Total number of events to send")
	flag.IntVar(&perSec, "persec", 10, "Number of Events per second to send")
	flag.BoolVar(&quiet, "q", false, "Quiet Logging? (default = verbose)")
	flag.IntVar(&timeFrame, "t", 0, "TimeFrame:  If this is > 0, spread 'ct' of events over this time frame (seconds) ")
	flag.StringVar(&file, "file", "datagen.json", "Json File defining data generation definition")
}

func LoadDataGen() bool {
	if jsonb, err := ioutil.ReadFile(file); err == nil {
		if err = json.Unmarshal(jsonb, &dataGen); err != nil {
			Log(ERROR, err)
			return false
		}
		return true
	} else {
		Log(ERROR, err)
	}
	return false
}

func Send(aid string, data []string) {
	qs := url.QueryEscape(strings.Join(data, "&"))
	Debug(dataGen.Url, " body = ", qs, data)
	buf := bytes.NewBufferString(qs)
	resp, err := http.Post(dataGen.Url, "application/x-www-form-urlencoded", buf)
	if err != nil {
		Log(ERROR, err.Error())
	}
	resp.Body.Close()
}

type Field struct {
	Name        string
	Cardinality int
	Values      []string
	Datatype    string
	Every       int
	Description string
}

type DataGen struct {
	Url    string
	Fields []*Field
}

func (d *Field) Val() string {
	if len(d.Values) > 0 {
		rv := rand.Intn(len(d.Values))
		return d.Values[rv]
	} else if d.Cardinality > 0 {
		ri := rand.Int63n(int64(d.Cardinality))
		if d.Datatype == "s" {
			return "xyz" + strconv.FormatInt(int64(ri), 10)
		} else if d.Datatype == "i" {
			return strconv.FormatInt(int64(ri), 10)
		} else if d.Datatype == "x" {

		}
	}
	return ""
}

func RunDataGen() {

	timer := time.NewTicker(time.Second / time.Duration(perSec))

	tsStart := time.Now().Unix() - int64(timeFrame)
	secPer := float64(timeFrame) / float64(maxCt)
	Logf(WARN, "Timeframe=%d  maxct=%d  secPer=%v", timeFrame, maxCt, secPer)
	var totalCt int64 = 0

	Logf(ERROR, "Gen Data: maxct=%d persec=%d, secPer=%v, file=%s q=%v", maxCt, perSec, secPer, file, quiet)

	for _ = range timer.C {
		go func() {
			data := make([]string, 0)
			re := 0
			for _, f := range dataGen.Fields {
				if f.Every > 0 {
					re = rand.Intn(f.Every)
				}
				if f.Every == 0 || re == 0 {
					fv := f.Name + "=" + f.Val()
					data = append(data, fv)
				}
			}
			if timeFrame > 0 {
				ts := strconv.FormatInt(tsStart+int64(float64(totalCt)*secPer), 10)
				data = append(data, "_sts="+ts)
			}
			Send("12", data)
		}()

		totalCt++
		if totalCt >= int64(maxCt) {
			timer.Stop()
			break
		}
	}
}

func main() {
	flag.Parse()
	logLevel := "debug"
	if quiet {
		logLevel = "error"
	}
	SetLogger(log.New(os.Stderr, "", log.Ltime|log.Lshortfile), logLevel)
	if LoadDataGen() {
		RunDataGen()
	}
}
