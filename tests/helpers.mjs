import fs from 'node:fs'
import vm from 'node:vm'

const clone = (value) => value === undefined ? undefined : JSON.parse(JSON.stringify(value))

export function loadPlugin(id, configuration = {}, context = {}) {
  if (!/^plugin-[a-z0-9-]+$/.test(id)) throw new Error('Invalid plugin ID')
  const logs = []
  const log = (...args) => logs.push(args.map(String).join(' '))
  const sandbox = vm.createContext({
    ...context,
    configuration: clone(configuration),
    console: { log, info: log, warn: log, error: log, debug: log },
    Plugins: { Log: log, ...(context.Plugins || {}) }
  }, { codeGeneration: { strings: false, wasm: false } })
  const source = fs.readFileSync(new URL(`../plugins/${id}.js`, import.meta.url), 'utf8')
  vm.runInContext(source, sandbox, { filename: id + '.js', timeout: 1000 })
  return {
    logs,
    run(trigger, ...args) {
      if (!['onGenerate', 'onSubscribe', 'onRun'].includes(trigger)) throw new Error('Invalid trigger')
      sandbox.__argsJSON = JSON.stringify(args)
      vm.runInContext(`var __args = JSON.parse(__argsJSON); var __result = ${trigger}.apply(undefined, __args); if (__result === undefined) __result = __args[0];`, sandbox, { timeout: 1000 })
      if (sandbox.__result?.then) throw new Error('Async result requires the real Goja harness')
      if (sandbox.__result === null) throw new Error('Null plugin result')
      return clone(sandbox.__result)
    }
  }
}

export function runPlugin(id, configuration, input, trigger = 'onGenerate', context = {}) {
  return loadPlugin(id, configuration, context).run(trigger, input)
}
