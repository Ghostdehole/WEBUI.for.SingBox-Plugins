// Executes the published catalog in the actual WebUI Goja host. Run from a
// checkout of WEBUI.for.SingBox: go run ../plugin-hub/tests/goja/main.go ../plugin-hub
package main

import (
	"context"
	"encoding/json"
	"fmt"
	"os"
	"os/exec"
	"path/filepath"
	"reflect"
	"runtime"
	"strconv"
	"strings"
	"time"

	"guiforcores/bridge/plugincatalog"
	"guiforcores/bridge/plugins"
	"guiforcores/bridge/storage"
)

type fixture struct {
	Name          string           `json:"name"`
	Plugin        string           `json:"plugin"`
	Configuration map[string]any   `json:"configuration"`
	Input         map[string]any   `json:"input"`
	Trigger       string           `json:"trigger"`
	Proxies       []map[string]any `json:"proxies"`
	Subscription  map[string]any   `json:"subscription"`
	Checks        map[string]any   `json:"checks"`
	Error         string           `json:"error"`
	Idempotent    bool             `json:"idempotent"`
	CoreCheck     bool             `json:"core_check"`
	CoreOS        []string         `json:"core_os"`
}

func main() {
	started := time.Now()
	if len(os.Args) != 2 {
		panic("usage: go run tests/goja/main.go PLUGIN_REPO")
	}
	root, err := filepath.Abs(os.Args[1])
	must(err)
	items, err := plugincatalog.Read(func(name string) ([]byte, error) { return os.ReadFile(filepath.Join(root, filepath.FromSlash(name))) })
	must(err)
	data, err := os.ReadFile(filepath.Join(root, "tests", "fixtures.json"))
	must(err)
	var fixtures []fixture
	must(json.Unmarshal(data, &fixtures))
	for _, item := range fixtures {
		for _, platform := range item.CoreOS {
			if !item.CoreCheck || (platform != "linux" && platform != "windows" && platform != "darwin") {
				panic(item.Name + ": invalid core_os constraint")
			}
		}
	}
	dir, err := os.MkdirTemp("", "router-plugin-goja-")
	must(err)
	defer os.RemoveAll(dir)
	suiteTimeout := 60 * time.Second
	if value := os.Getenv("WEBUI_PLUGIN_SUITE_TIMEOUT"); value != "" {
		parsed, err := time.ParseDuration(value)
		must(err)
		if parsed <= 0 || parsed > 15*time.Minute {
			panic("WEBUI_PLUGIN_SUITE_TIMEOUT must be positive and at most 15m")
		}
		suiteTimeout = parsed
	}
	fmt.Printf("Actual Goja suite timeout: %s; production hook/pipeline timeouts remain %s/%s\n", suiteTimeout, plugins.HookTimeout, plugins.PipelineTimeout)
	ctx, cancel := context.WithTimeout(context.Background(), suiteTimeout)
	defer cancel()
	byID := map[string]plugins.Plugin{}
	for _, plugin := range items {
		byID[plugin.ID] = plugin
		if plugin.ManualTarget == "diagnostic" {
			continue
		}
		service, err := plugins.NewService(storage.NewPaths(filepath.Join(dir, plugin.ID)))
		must(err)
		_, err = service.Save(plugin, 0)
		must(err)
		for _, trigger := range plugin.Triggers {
			started := time.Now()
			switch trigger {
			case plugins.OnSubscribe:
				_, err = service.ApplySubscription(ctx, []map[string]any{{"type": "direct", "tag": "France node", "__id_in_gui": "identity"}}, map[string]any{"name": "fixture"})
				fmt.Printf("Default %s %s: %s\n", plugin.ID, trigger, time.Since(started))
				must(err)
			case plugins.OnGenerate:
				_, err = service.ApplyConfig(ctx, map[string]any{"outbounds": []any{map[string]any{"type": "direct", "tag": "direct"}}})
				fmt.Printf("Default %s %s: %s\n", plugin.ID, trigger, time.Since(started))
				must(err)
			}
		}
	}
	coreChecks, coreSkips := 0, 0
	for index, item := range fixtures {
		plugin, exists := byID[item.Plugin]
		if !exists {
			panic("fixture plugin not found: " + item.Plugin)
		}
		plugin.Configuration = item.Configuration
		service, err := plugins.NewService(storage.NewPaths(filepath.Join(dir, strconv.Itoa(index))))
		must(err)
		_, err = service.Save(plugin, 0)
		must(err)
		var input any = item.Input
		apply := func(value any) (any, error) { return service.ApplyConfig(ctx, value.(map[string]any)) }
		if item.Trigger == plugins.OnSubscribe {
			if item.CoreCheck {
				panic(item.Name + ": subscription fixture cannot request core_check")
			}
			input = item.Proxies
			apply = func(value any) (any, error) {
				return service.ApplySubscription(ctx, value.([]map[string]any), item.Subscription)
			}
		} else if item.Trigger != "" && item.Trigger != plugins.OnGenerate {
			panic(item.Name + ": invalid trigger")
		}
		before, _ := json.Marshal(input)
		started := time.Now()
		result, err := apply(input)
		fmt.Printf("Fixture %s: %s\n", item.Name, time.Since(started))
		after, _ := json.Marshal(input)
		if string(before) != string(after) {
			panic(item.Name + ": mutated original input")
		}
		if item.Error != "" {
			if err == nil || !strings.Contains(err.Error(), item.Error) {
				panic(fmt.Sprintf("%s: wanted error %q, got %v", item.Name, item.Error, err))
			}
			continue
		}
		must(err)
		for path, want := range item.Checks {
			got := lookup(result, path)
			if !reflect.DeepEqual(got, want) {
				panic(fmt.Sprintf("%s %s: got %#v want %#v", item.Name, path, got, want))
			}
		}
		if item.Idempotent {
			started := time.Now()
			second, err := apply(result)
			fmt.Printf("Fixture %s repeat: %s\n", item.Name, time.Since(started))
			must(err)
			a, _ := json.Marshal(result)
			b, _ := json.Marshal(second)
			if string(a) != string(b) {
				panic(item.Name + ": non-idempotent transformation")
			}
		}
		if item.CoreCheck {
			binary := os.Getenv("SING_BOX_114_PATH")
			supported := len(item.CoreOS) == 0
			for _, platform := range item.CoreOS {
				supported = supported || platform == runtime.GOOS
			}
			if !supported {
				coreSkips++
				fmt.Printf("SKIP real core check: %s (requires %s; running %s). Goja assertions passed.\n", item.Name, strings.Join(item.CoreOS, ","), runtime.GOOS)
				continue
			}
			if binary == "" {
				coreSkips++
				fmt.Printf("SKIP real core check: %s (SING_BOX_114_PATH is unset). Goja assertions passed.\n", item.Name)
				continue
			}
			raw, _ := json.Marshal(result)
			file := filepath.Join(dir, strconv.Itoa(index)+".json")
			must(os.WriteFile(file, raw, 0600))
			checkCtx, stop := context.WithTimeout(ctx, 10*time.Second)
			out, err := exec.CommandContext(checkCtx, binary, "check", "-c", file).CombinedOutput()
			stop()
			if err != nil {
				panic(fmt.Sprintf("%s: real sing-box check: %v\n%s", item.Name, err, out))
			}
			coreChecks++
		}
	}
	fmt.Printf("Actual Goja: %d catalog plugins validated, %d transformation fixtures passed; real core: %d passed, %d skipped\n", len(items), len(fixtures), coreChecks, coreSkips)
	fmt.Printf("Actual Goja suite elapsed: %s\n", time.Since(started))
}
func must(err error) {
	if err != nil {
		panic(err)
	}
}
func lookup(value any, path string) any {
	raw, _ := json.Marshal(value)
	_ = json.Unmarshal(raw, &value)
	for _, part := range strings.Split(path, ".") {
		switch current := value.(type) {
		case map[string]any:
			value = current[part]
		case []any:
			i, err := strconv.Atoi(part)
			if err != nil || i < 0 || i >= len(current) {
				return nil
			}
			value = current[i]
		default:
			return nil
		}
	}
	// Goja's exported numbers are decoded as json.Number; normalize both sides.
	raw, _ = json.Marshal(value)
	var plain any
	_ = json.Unmarshal(raw, &plain)
	return plain
}
