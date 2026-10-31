import test from 'node:test'
import assert from 'node:assert/strict'
import { runPlugin, loadPlugin } from './helpers.mjs'

const names = ['outbound-chain-manager','config-override','add-rulesets','router-transparent-proxy','router-listeners']
const run = (name, configuration, input = base()) => runPlugin('plugin-' + name, configuration, input)
const json = JSON.stringify
const base = () => ({
  log: { level: 'info' },
  inbounds: [{ type: 'mixed', tag: 'local', listen: '127.0.0.1', listen_port: 1080 }],
  outbounds: [
    { type: 'direct', tag: 'direct' },
    ...['A','B','C'].map(tag => ({ type: 'socks', tag, server: '192.0.2.1', server_port: 1080 })),
    { type: 'selector', tag: 'group', outbounds: ['A','B'] }
  ],
  services: [{ type: 'api', tag: 'native-api', listen: '127.0.0.1', listen_port: 20123, secret: 'unchanged', dashboard: true }],
  dns: { servers: [{ type: 'udp', tag: 'dns', server: '1.1.1.1' }], final: 'dns' },
  route: { auto_detect_interface: true, final: 'direct', rules: [{ domain: ['example.org'], action: 'route', outbound: 'A' }] }
})
const chain = rules => ({ Rules: json(rules) })
const override = (patch, paths = []) => ({ Enabled: true, Override: json(patch), AppendPaths: json(paths) })
const tun = extra => ({ Enabled: true, LANInterfaces: '["br-lan"]', ...extra })
const listener = extra => ({ tag: 'extra', type: 'mixed', listen_port: 18080, ...extra })
const listens = entries => ({ Listeners: json(entries) })
const ruleset = extra => ({ tag: 'chosen', url: 'https://example.org/chosen.srs', format: 'binary', ...extra })
const sets = entries => ({ Rulesets: json(entries) })

for (const name of names) {
  test(name + ': defaults leave configuration unchanged', () => {
    const input = base(), before = structuredClone(input)
    assert.deepEqual(run(name, {}, input), before)
    assert.deepEqual(input, before)
  })
}

test('chain expands nested groups and preserves input and native API', () => {
  const input = base()
  input.outbounds.push({ type: 'selector', tag: 'nested', outbounds: ['group'] })
  const before = structuredClone(input)
  const result = run('outbound-chain-manager', chain([{ source: 'nested', target: 'C' }]), input)
  assert.equal(result.outbounds.find(p => p.tag === 'A').detour, 'C')
  assert.equal(result.outbounds.find(p => p.tag === 'B').detour, 'C')
  assert.equal(result.outbounds.find(p => p.tag === 'group').detour, undefined)
  assert.deepEqual(result.services, input.services)
  assert.deepEqual(input, before)
})
test('chain recursive=false processes only direct leaf members', () => {
  const input = base()
  input.outbounds.push({ type: 'selector', tag: 'nested', outbounds: ['group','C'] })
  const result = run('outbound-chain-manager', chain([{ source: 'nested', target: 'direct', recursive: false }]), input)
  assert.equal(result.outbounds.find(p => p.tag === 'C').detour, 'direct')
  assert.equal(result.outbounds.find(p => p.tag === 'A').detour, undefined)
})
test('chain rejects overlapping sources', () => assert.throws(() => run('outbound-chain-manager', chain([{ source:'group', target:'C' },{ source:'A', target:'C' }])), /Duplicate chain source/))
test('chain rejects missing source and target', () => {
  for (const rule of [{ source:'missing',target:'B' },{ source:'A',target:'missing' }]) assert.throws(() => run('outbound-chain-manager', chain([rule])), /Unknown outbound target/)
})
test('chain rejects self, indirect and group membership cycles atomically', () => {
  for (const rules of [ [{source:'A',target:'A'}], [{source:'A',target:'B'},{source:'B',target:'A'}], [{source:'A',target:'group'}] ]) {
    const input = base(), before = structuredClone(input)
    assert.throws(() => run('outbound-chain-manager', chain(rules), input), /cycle/i)
    assert.deepEqual(input, before)
  }
})
test('chain includes existing detours in cycle detection and refuses overwrite', () => {
  const input = base(); input.outbounds[2].detour = 'A'
  assert.throws(() => run('outbound-chain-manager', chain([{source:'A',target:'B'}]), input), /cycle/i)
  assert.throws(() => run('outbound-chain-manager', chain([{source:'B',target:'C'}]), input), /Existing detour/)
})
test('chain refuses dial settings that detour would disable', () => {
  const input=base(); input.outbounds[1].bind_interface='wan'
  assert.throws(() => run('outbound-chain-manager', chain([{source:'A',target:'B'}]), input), /ignore bind_interface/)
})
test('chain refuses malformed JSON, fields, booleans and duplicate tags', () => {
  assert.throws(() => run('outbound-chain-manager', {Rules:'{'}), /invalid JSON/)
  assert.throws(() => run('outbound-chain-manager', chain([{source:'A',target:'B',detour:'C'}])), /unknown field/)
  assert.throws(() => run('outbound-chain-manager', chain([{source:'A',target:'B',recursive:'false'}])), /boolean/)
  const input=base(); input.outbounds.push({...input.outbounds[1]})
  assert.throws(() => run('outbound-chain-manager', chain([{source:'A',target:'B'}]),input), /Duplicate outbound/)
})

test('override deep merges and appends only configured arrays', () => {
  const input=base(), before=structuredClone(input)
  const result=run('config-override', override({log:{level:'debug'},route:{rules:[{domain:['example.net'],outbound:'B'}]}},['route.rules']),input)
  assert.equal(result.log.level,'debug')
  assert.equal(result.route.rules.length,2)
  assert.deepEqual(result.services,input.services)
  assert.deepEqual(input,before)
})
test('override replaces ordinary arrays when append is not selected', () => {
  const result=run('config-override',override({route:{rules:[{domain:['example.net'],outbound:'B'}]}}))
  assert.equal(result.route.rules.length,1)
  assert.equal(result.route.rules[0].outbound,'B')
})
test('override rejects stale append paths and wrong target types', () => {
  assert.throws(()=>run('config-override',override({log:{level:'debug'}},['route.rules'])),/did not match/)
  assert.throws(()=>run('config-override',override({log:{level:[]}},['log.level'])),/not an array/)
})
test('override rejects prototype keys recursively', () => {
  for (const text of ['{"__proto__":{"polluted":true}}','{"log":{"constructor":{}}}','{"route":{"rules":[{"prototype":{}}]}}']) {
    assert.throws(()=>run('config-override',{Enabled:true,Override:text}),/Unsafe object key/)
    assert.equal({}.polluted,undefined)
  }
})
test('override cannot remove or replace existing TUN or listener', () => {
  const input=base(); input.inbounds.push({type:'tun',tag:'old-tun',address:['172.18.0.1/30']})
  assert.throws(()=>run('config-override',override({inbounds:[]}),input),/cannot be removed or overwritten/)
  const changed=structuredClone(input.inbounds); changed[0].listen_port=2080
  assert.throws(()=>run('config-override',override({inbounds:changed}),input),/cannot be removed or overwritten/)
})
test('override protects native API and rejects new legacy API', () => {
  assert.throws(()=>run('config-override',override({services:[]})),/native API/)
  const changed=base().services; changed[0].secret='other'
  assert.throws(()=>run('config-override',override({services:changed})),/native API/)
  assert.throws(()=>run('config-override',override({experimental:{clash_api:{external_controller:'0.0.0.0:9090'}}})),/legacy Clash API/)
})
test('override checks new ports, new tag collisions, unknown targets and cycles', () => {
  assert.throws(()=>run('config-override',override({inbounds:[listener({listen_port:20123})]},['inbounds'])),/port already/)
  assert.throws(()=>run('config-override',override({inbounds:[listener({tag:'local'})]},['inbounds'])),/Duplicate inbound/)
  assert.throws(()=>run('config-override',override({route:{final:'missing'}})),/Unknown outbound/)
  assert.throws(()=>run('config-override',override({outbounds:[{type:'selector',tag:'x',outbounds:['x']}]})),/cycle/i)
  const result=run('config-override',override({inbounds:[listener()]},['inbounds']))
  assert.equal(result.inbounds.length,2)
})

test('rulesets adds only explicit choices and appends optional routes', () => {
  const input=base(),result=run('add-rulesets',sets([ruleset({outbound:'B',download_detour:'direct',update_interval:'24h'})]),input)
  assert.equal(result.route.rule_set.length,1)
  assert.equal(result.route.rule_set[0].tag,'chosen')
  assert.equal(result.route.rules[1].outbound,'B')
  assert.deepEqual(result.services,input.services)
  assert.equal(input.route.rule_set,undefined)
})
test('rulesets supports explicit reject and prepend, while an unassigned set adds no route', () => {
  const result=run('add-rulesets',{...sets([ruleset({action:'reject'}),ruleset({tag:'available',format:'source',url:'https://example.org/available.json'})]),RulePosition:'prepend'})
  assert.equal(result.route.rules[0].action,'reject')
  assert.equal(result.route.rules.length,2)
  assert.equal(result.route.rule_set.length,2)
})
test('rulesets refuses duplicate tags, unknown detours and unsafe/invalid fields', () => {
  assert.throws(()=>run('add-rulesets',sets([ruleset(),ruleset()])),/tag already exists/)
  const input=base(); input.route.rule_set=[ruleset()]
  assert.throws(()=>run('add-rulesets',sets([ruleset()]),input),/tag already exists/)
  for (const changes of [{outbound:'missing'},{download_detour:'missing'}]) assert.throws(()=>run('add-rulesets',sets([ruleset(changes)])),/Unknown outbound/)
  for (const url of ['http://example.org/x','https://user:pass@example.org/x','https://example.org/x#secret']) assert.throws(()=>run('add-rulesets',sets([ruleset({url})])),/HTTPS/)
  assert.throws(()=>run('add-rulesets',sets([ruleset({format:'yaml'})])),/format/)
  assert.throws(()=>run('add-rulesets',sets([ruleset({action:'reject',outbound:'B'})])),/reject cannot/)
})

test('transparent proxy explicitly creates only a scoped Linux TUN, preserves default route and API', () => {
  const input=base(),before=structuredClone(input)
  const result=run('router-transparent-proxy',tun({ClientRules:json([{source_ip_cidr:['192.168.8.10/32'],outbound:'B'}]),DefaultOutbound:'group'}),input)
  const inbound=result.inbounds[1]
  assert.equal(inbound.type,'tun'); assert.equal(inbound.auto_route,true); assert.equal(inbound.auto_redirect,true)
  assert.deepEqual(inbound.include_interface,['br-lan']); assert.equal(inbound.dns_mode,'disabled')
  assert.equal(inbound.stack,undefined)
  assert.deepEqual(result.route.rules[0].inbound,['router-tun'])
  assert.equal(result.route.final,'direct')
  assert.deepEqual(result.services,input.services)
  assert.deepEqual(input,before)
})
test('transparent DNS hijack requires configured DNS and scopes port 53 to added TUN', () => {
  const result=run('router-transparent-proxy',tun({HijackDNS:true}))
  assert.equal(result.inbounds[1].dns_mode,'hijack')
  assert.deepEqual(result.route.rules[0],{inbound:['router-tun'],port:53,action:'hijack-dns'})
  const input=base(); delete input.dns
  assert.throws(()=>run('router-transparent-proxy',tun({HijackDNS:true}),input),/Configure DNS/)
})
test('transparent proxy refuses guessed interfaces and existing TUN or duplicate tag', () => {
  assert.throws(()=>run('router-transparent-proxy',{Enabled:true}),/Explicit LANInterfaces/)
  const input=base(); input.inbounds.push({type:'tun',tag:'existing'})
  assert.throws(()=>run('router-transparent-proxy',tun(),input),/existing TUN/)
  assert.throws(()=>run('router-transparent-proxy',tun({Tag:'local'})),/tag already exists/)
})
test('transparent proxy refuses auto_redirect mark conflicts including DNS dial options', () => {
  for (const amend of [c=>c.route.default_mark=123,c=>c.outbounds[1].routing_mark='0x2024',c=>c.dns.servers[0].routing_mark=234]) {
    const input=base(); amend(input)
    assert.throws(()=>run('router-transparent-proxy',tun(),input),/auto_redirect conflicts/)
  }
})
test('transparent proxy rejects missing targets, CIDR typos and incompatible interface choices', () => {
  assert.throws(()=>run('router-transparent-proxy',tun({DefaultOutbound:'missing'})),/Unknown outbound/)
  assert.throws(()=>run('router-transparent-proxy',tun({ClientRules:'[{"source_ip_cidr":[],"outbound":"B"}]'})),/must contain/)
  for (const address of ['999.1.2.3/24','192.168.8.1/33','fe80::1/129',':1::2/64','172.19.0.1']) assert.throws(()=>run('router-transparent-proxy',tun({Addresses:json([address])})),/Invalid CIDR/)
  assert.throws(()=>run('router-transparent-proxy',tun({InterfaceName:'br-lan'})),/overlapping/)
  assert.throws(()=>run('router-transparent-proxy',tun({HijackDNS:true,Addresses:'["172.19.0.1/32"]'})),/adjacent/)
  const input=base(); input.route.auto_detect_interface=false
  assert.throws(()=>run('router-transparent-proxy',tun(),input),/auto_detect_interface/)
})

test('listeners creates all three types with scoped targets or existing global policy', () => {
  const input=base(),before=structuredClone(input)
  const result=run('router-listeners',listens([listener({type:'http',outbound:'B'}),listener({tag:'socks',type:'socks',listen_port:18081}),listener({tag:'mixed',listen_port:18082,listen:'192.168.8.1',users:[{username:'admin',password:'not-real'}]})]),input)
  assert.equal(result.inbounds.length,4)
  assert.deepEqual(result.route.rules[0],{inbound:['extra'],action:'route',outbound:'B'})
  assert.equal(result.route.rules.length,2)
  assert.deepEqual(result.services,input.services)
  assert.deepEqual(input,before)
})
test('listeners requires explicit unauthenticated LAN consent', () => {
  for (const listen of ['0.0.0.0','::','192.168.8.1','fd00::1']) assert.throws(()=>run('router-listeners',listens([listener({listen})])),/Non-loopback/)
  assert.equal(run('router-listeners',listens([listener({listen:'0.0.0.0',allow_lan_without_auth:true})])).inbounds.length,2)
  for (const listen of ['127.1.2.3','::1','0:0:0:0:0:0:0:1']) assert.equal(run('router-listeners',listens([listener({listen})])).inbounds.length,2)
})
test('listeners detects existing inbound, endpoint, service, native API and newly duplicated ports', () => {
  for (const p of [1080,20123]) assert.throws(()=>run('router-listeners',listens([listener({listen_port:p})])),/port already/)
  const input=base(); input.endpoints=[{type:'wireguard',tag:'wg',listen_port:18080}]
  assert.throws(()=>run('router-listeners',listens([listener()]),input),/port already/)
  assert.throws(()=>run('router-listeners',listens([listener(),listener({tag:'other'})])),/port already/)
  const input2=base(); input2.services.push({type:'derp',tag:'derp',listen_port:18080})
  assert.throws(()=>run('router-listeners',listens([listener()]),input2),/port already/)
})
test('listeners validates tags, targets, ports, IP literals and user records strictly', () => {
  assert.throws(()=>run('router-listeners',listens([listener({tag:'local'})])),/tag already/)
  assert.throws(()=>run('router-listeners',listens([listener({outbound:'missing'})])),/Unknown outbound/)
  for (const listen_port of [0,65536,1.2,'18080','18080abc']) assert.throws(()=>run('router-listeners',listens([listener({listen_port})])),/integer/)
  for (const listen of ['localhost','[::1]',':1::2','256.0.0.1']) assert.throws(()=>run('router-listeners',listens([listener({listen})])),/IP literal/)
  assert.throws(()=>run('router-listeners',listens([listener({users:[{username:'',password:'x'}]})])),/username/)
  assert.throws(()=>run('router-listeners',listens([listener({users:[{username:'x',password:''}]})])),/password/)
  assert.throws(()=>run('router-listeners',listens([listener({type:'tproxy'})])),/type must/)
  assert.throws(()=>run('router-listeners',listens([listener({proxy:'A'})])),/unknown field/)
})

const goJSON = value => JSON.parse(JSON.stringify(value, (_key, item) => {
  if (item && typeof item === 'object' && !Array.isArray(item)) return Object.fromEntries(Object.entries(item).sort(([a],[b]) => a < b ? -1 : a > b ? 1 : 0))
  return item
}))

test('chain and URLTest safely compose in either order after Go map serialization', () => {
  const chainConfig = chain([{source:'group', target:'C'}])
  const urltestConfig = {Enabled:true,Outbounds:'A\nB',SelectorTag:'group'}
  const chainFirst = runPlugin('plugin-router-urltest', urltestConfig, goJSON(run('outbound-chain-manager', chainConfig)))
  const urltestFirst = run('outbound-chain-manager', chainConfig, goJSON(runPlugin('plugin-router-urltest', urltestConfig, base())))
  assert.deepEqual(goJSON(chainFirst), goJSON(urltestFirst))
  assert.deepEqual(chainFirst.services, base().services)
  assert.equal(chainFirst.outbounds.find(item=>item.tag==='A').detour, 'C')
  assert.deepEqual(chainFirst.outbounds.at(-1).outbounds, ['A','B'])
})

test('chain cannot use a generated URLTest group that resolves back to its source', () => {
  const input = runPlugin('plugin-router-urltest', {Enabled:true,Outbounds:'A\nB'}, base())
  assert.throws(()=>run('outbound-chain-manager',chain([{source:'A',target:'router-auto'}]),goJSON(input)),/cycle/i)
  assert.deepEqual(input.outbounds.filter(item=>item.detour),[])
})

test('each naming strategy composes with dedupe without losing node fields or internal references', () => {
  const ids = ['plugin-index-the-proxy-name','plugin-modify-proxy-name','plugin-beautiful-node-name']
  const input = [
    {type:'socks',tag:'HK1',server:'192.0.2.1',server_port:1080,__id_in_gui:'keep'},
    {__id_in_gui:'duplicate',server_port:1080,server:'192.0.2.1',tag:'HK2',type:'socks'},
    {type:'socks',tag:'JP',server:'192.0.2.2',server_port:1080,detour:'HK2',__id_in_gui:'dependent'},
    {type:'selector',tag:'chosen',outbounds:['HK1','HK2','JP'],default:'HK2',__id_in_gui:'selector'}
  ]
  for (const id of ids) {
    const name = data => loadPlugin(id,{}).run('onSubscribe',goJSON(data),{name:'Sub'})
    const dedupe = data => loadPlugin('plugin-duplicate-proxies-removal',{}).run('onSubscribe',goJSON(data))
    for (const output of [dedupe(name(input)),name(dedupe(input))]) {
      assert.equal(output.length,3)
      const byID=Object.fromEntries(output.map(item=>[item.__id_in_gui,item]))
      assert.equal(byID.keep.server,'192.0.2.1')
      assert.equal(byID.dependent.detour,byID.keep.tag)
      assert.equal(byID.selector.default,byID.keep.tag)
      assert.deepEqual(new Set(byID.selector.outbounds),new Set([byID.keep.tag,byID.dependent.tag]))
      assert.equal(byID.duplicate,undefined)
    }
  }
  assert.equal(input[2].detour,'HK2')
})
