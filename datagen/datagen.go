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
# spread 5000 events over 11 minutes
./datagen -ct 5000 -persec 20  -t 665 -file demo.json

# spread 10000 events over 1 day
./datagen -ct 10000 -persec 10  -t 86400 -file demo.json

./datagen -ct 10000 -persec 20  -t 452000 -file si.json

# use a different timezone
./datagen -ct 10000 -persec 20  -tz 8 -t 452000 -file si.json
*/

var (
	maxCt     int
	perSec    int
	extraCt   int
	timeFrame int
	timeZone  int
	quiet     bool
	file      string
	timeStart string
	dataGen   *DataGen
)

func init() {
	flag.IntVar(&timeZone, "tz", 7, "Time Zone")
	flag.IntVar(&maxCt, "ct", 10, "Total number of events to send")
	flag.IntVar(&extraCt, "ex", 100, "Extra Number of events to send after 'done'")
	flag.IntVar(&perSec, "persec", 10, "Number of Events per second to send")
	flag.BoolVar(&quiet, "q", false, "Quiet Logging? (default = verbose)")
	flag.IntVar(&timeFrame, "t", 0, "TimeFrame:  If this is > 0, spread 'ct' of events over this time frame (seconds) ")
	flag.StringVar(&file, "file", "datagen.json", "Json File defining data generation definition")
	flag.StringVar(&timeStart, "start", "", "Time to start the time-stamps (format:   2012-08-15 ) else default to now - TimeFrame")
	rand.Seed(time.Now().Unix())
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

func Send(data []string) {
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
		if d.Datatype == "s" || d.Datatype == "string" {
			return "xyz" + strconv.FormatInt(int64(ri), 10)
		} else if d.Datatype == "i" || d.Datatype == "int" {
			return strconv.FormatInt(int64(ri), 10)
		} else if d.Datatype == "x" {

		}
	}
	return ""
}

func RunDataGen() {

	timer := time.NewTicker(time.Second / time.Duration(perSec))

	tn := time.Now()
	if len(timeStart) > 0 {
		if dt, err := time.Parse("2006-01-02", timeStart); err == nil {
			tn = dt
		} else {
			Log(ERROR, err)
		}
	}
	t1 := time.Date(tn.Year(), tn.Month(), tn.Day(), timeZone, 0, 0, 0, time.UTC)
	tsStart := t1.Unix() - int64(timeFrame)
	//tsStart := time.Date(2006, 1, 2, 0, 0, 0, 0, time.UTC)
	//t1 := time.Date(2006, 1, -2, 0, 0, 0, 0, time.UTC)
	secPer := float64(timeFrame) / float64(maxCt)
	Logf(WARN, "Timeframe=%d  maxct=%d  secPer=%v start=%v", timeFrame, maxCt, secPer, t1)
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
				tsi := tsStart + int64(float64(totalCt)*secPer)
				ts := strconv.FormatInt(tsi, 10)
				data = append(data, "_sts="+ts)
				Logf(WARN, "ts=%s   %v", ts, time.Unix(tsi, 0))
			}
			Send(data)
		}()

		totalCt++
		if totalCt >= int64(maxCt+extraCt) {
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
