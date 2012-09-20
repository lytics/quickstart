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
./datagen -ct 1000 -persec 10  -file si.json


*/

var (
	maxCt   int
	perSec  int
	quiet   bool
	file    string
	dataGen *DataGen
)

func init() {
	flag.IntVar(&maxCt, "ct", 10, "Total number of events to send")
	flag.IntVar(&perSec, "persec", 10, "Number of Events per second to send")
	flag.BoolVar(&quiet, "q", false, "Quiet Logging? (default = verbose)")
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

	var qs string = strings.Join(data, "&")
	qs = url.QueryEscape(qs)
	Debug(dataGen.Url, " body = ", qs, data)
	buf := bytes.NewBufferString(qs)
	_, err := http.Post(dataGen.Url, "application/x-www-form-urlencoded", buf)
	if err != nil {
		Log(ERROR, err.Error())
	}
}

type Field struct {
	Name string
	//Url         string
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

func MD(d *Field) string {
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

	totalCt := 0

	Debug("max ct loop = ", maxCt)
	Debug("per sec = ", perSec)

	for _ = range timer.C {
		Debug("inside loop")
		go func() {
			data := make([]string, 0)
			re := 0
			for _, f := range dataGen.Fields {
				if f.Every > 0 {
					re = rand.Intn(f.Every)
				}
				//debug("rand val ", f.Every, " val = ", re)
				if f.Every == 0 || re == 0 {
					fv := f.Name + "=" + MD(f)
					data = append(data, fv)
				}
			}
			Send("12", data)
		}()

		totalCt++
		if totalCt >= maxCt {
			timer.Stop()
			break
		}
	}

}

func main() {
	flag.Parse()
	logLevel := "debug"
	if !quiet {
		logLevel = "error"
	}
	SetLogger(log.New(os.Stderr, "", log.Ltime|log.Lshortfile))
	if LoadDataGen() {
		RunDataGen()
	}
}
