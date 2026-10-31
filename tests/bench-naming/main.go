// Compare fresh Goja invocations using the indexed matcher and its test-only
// reference. From WebUI: go run ../plugin-hub/tests/bench-naming/main.go ../plugin-hub
package main

import (
	"encoding/json"
	"fmt"
	"os"
	"path/filepath"
	"sort"
	"strings"
	"time"

	"github.com/dop251/goja"
)

func main() {
	if len(os.Args) != 2 {
		panic("usage: benchmark PLUGIN_REPO")
	}
	root := os.Args[1]
	read := func(name string) string {
		data, err := os.ReadFile(filepath.Join(root, filepath.FromSlash(name)))
		must(err)
		return strings.ReplaceAll(string(data), "\r\n", "\n")
	}
	current := read("sources/naming/regions.js")
	previous := read("tests/fixtures/naming-regions-before-index.js")
	var regions []struct {
		StandardName struct {
			Zh string `json:"zh"`
		} `json:"standardName"`
	}
	must(json.Unmarshal([]byte(read("sources/naming/region-data.json")), &regions))
	inputs := map[string][]map[string]any{"single": {{"type": "direct", "tag": "France node"}}}
	for _, region := range regions {
		inputs["high-match-142"] = append(inputs["high-match-142"], map[string]any{"type": "direct", "tag": region.StandardName.Zh + " 01"})
		inputs["low-match-142"] = append(inputs["low-match-142"], map[string]any{"type": "direct", "tag": fmt.Sprintf("qzxqzx %03d", len(inputs["low-match-142"]))})
	}
	for _, id := range []string{"plugin-modify-proxy-name", "plugin-beautiful-node-name", "plugin-subscription-organizer"} {
		source := read("plugins/" + id + ".js")
		if strings.Count(source, current) != 1 {
			panic("missing generated region fragment: " + id)
		}
		reference := map[string]string{}
		for _, variant := range []string{"reference", "indexed"} {
			code := source
			if variant == "reference" {
				code = strings.Replace(code, current, previous, 1)
			}
			program, err := goja.Compile(id, code, false)
			must(err)
			for _, scenario := range []string{"single", "low-match-142", "high-match-142"} {
				input, err := json.Marshal(inputs[scenario])
				must(err)
				invoke, err := goja.Compile("invoke", `var configuration={Enabled:true,RenameMode:'beautify'}; onSubscribe(JSON.parse(inputJSON),{});`, false)
				must(err)
				times := make([]time.Duration, 5)
				for i := range times {
					start := time.Now()
					vm := goja.New()
					must(vm.Set("inputJSON", string(input)))
					_, err = vm.RunProgram(program)
					must(err)
					result, err := vm.RunProgram(invoke)
					must(err)
					times[i] = time.Since(start)
					if i == 0 {
						raw, err := json.Marshal(result.Export())
						must(err)
						if variant == "reference" {
							reference[scenario] = string(raw)
						} else if reference[scenario] != string(raw) {
							panic(id + ": changed output for " + scenario)
						}
					}
				}
				sort.Slice(times, func(i, j int) bool { return times[i] < times[j] })
				fmt.Printf("%s %s %s median=%s\n", id, variant, scenario, times[len(times)/2])
			}
		}
	}
}

func must(err error) {
	if err != nil {
		panic(err)
	}
}
