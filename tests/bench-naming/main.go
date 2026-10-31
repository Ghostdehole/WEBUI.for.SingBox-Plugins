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
	runtimeIndex := read("tests/fixtures/naming-regions-runtime-index.js")
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
		for _, variant := range []string{"reference", "runtime-index", "precomputed"} {
			code := source
			if variant != "precomputed" {
				baseline := previous
				if variant == "runtime-index" {
					baseline = runtimeIndex
				}
				code = strings.Replace(code, current, baseline, 1)
				start := strings.Index(code, "// BEGIN GENERATED REGION INDEX\n")
				endMarker := "// END GENERATED REGION INDEX\n"
				end := strings.Index(code, endMarker)
				if start < 0 || end < start {
					panic("missing generated index markers")
				}
				code = code[:start] + code[end+len(endMarker):]
			}
			program, err := goja.Compile(id, code, false)
			must(err)
			if variant == "precomputed" {
				// Verify Node's build-time Unicode casing, stable ranks and bucket
				// ordering against all 907 entries derived by the actual Goja host.
				vm := goja.New()
				_, err = vm.RunProgram(program)
				must(err)
				_, err = vm.RunString(`function inspectIndex(index) {
return JSON.stringify(['regions','cities'].map(function(key) {
 return Array.from(index[key],function(entry) { return [entry[0],entry[1].map(function(rule) {
 return [rule.keyword,rule.folded,rule.region.emoji,rule.chinese,rule.rank]; })]; });
})); } var builtIndexJSON=inspectIndex(RegionIndex);`)
				must(err)
				_, err = vm.RunString(runtimeIndex + `
if (builtIndexJSON !== inspectIndex(regionRules())) throw new Error('build-time index differs from Goja derivation');`)
				must(err)
			}
			for _, scenario := range []string{"single", "low-match-142", "high-match-142"} {
				input, err := json.Marshal(inputs[scenario])
				must(err)
				invoke, err := goja.Compile("invoke", `var configuration=JSON.parse(configurationJSON); onSubscribe(JSON.parse(inputJSON),{});`, false)
				must(err)
				times := make([]time.Duration, 5)
				for i := range times {
					start := time.Now()
					vm := goja.New()
					must(vm.Set("inputJSON", string(input)))
					must(vm.Set("configurationJSON", `{"Enabled":true,"RenameMode":"beautify"}`))
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
