import test from 'node:test'
import assert from 'node:assert/strict'
import { runPlugin } from './helpers.mjs'

const base = () => ({ dns: { servers: [{type:'local',tag:'local'}], final:'local', rules:[] }, inbounds:[], services:[{type:'experimental',tag:'preserve'}] })
test('DNS integrations are inert until explicitly enabled', () => {
  for (const id of ['plugin-hosts-management', 'plugin-adguardhome']) assert.deepEqual(runPlugin(id, {}, base()), base())
})
test('hosts add scoped DNS rules, preserve IPv6 and are idempotent', () => {
  const cfg = {Enabled:true, Hosts:'192.168.8.1 router.lan alias.lan # local\n::1 localhost\n192.168.8.1 router.lan'}
  const original = base()
  const result = runPlugin('plugin-hosts-management', cfg, original)
  assert.deepEqual(result.dns.servers[1].predefined, {'router.lan':['192.168.8.1'],'alias.lan':['192.168.8.1'],localhost:['::1']})
  assert.equal(result.dns.final, 'local')
  assert.deepEqual(result.services, original.services)
  assert.deepEqual(runPlugin('plugin-hosts-management', cfg, result), result)
  assert.deepEqual(original, base())
})
test('hosts reject malformed IP/domain/prototype payload and existing tag conflicts', () => {
  for (const Hosts of ['999.1.1.1 test.lan','1.2.3.4 __proto__','::: test.lan',':1:2:3:4:5:6:7:8 test.lan','1:2:3:4:5:6:7:8: test.lan','1.2.3.4 <img>','']) {
    assert.throws(() => runPlugin('plugin-hosts-management',{Enabled:true,Hosts},base()))
  }
  const existing = base(); existing.dns.servers.push({type:'local',tag:'router-hosts'})
  assert.throws(() => runPlugin('plugin-hosts-management',{Enabled:true,Hosts:'127.0.0.1 router.lan'},existing),/already in use/)
})
test('AdGuard integration preserves DNS final unless explicitly requested and detects local loops', () => {
  const cfg = {Enabled:true,Domains:'ads.test\ntracker.test'}
  const result = runPlugin('plugin-adguardhome', cfg, base())
  assert.equal(result.dns.final,'local')
  assert.equal(result.dns.servers[1].server_port,20053)
  assert.deepEqual(runPlugin('plugin-adguardhome',cfg,result),result)
  assert.equal(runPlugin('plugin-adguardhome',{...cfg,Mode:'final'},base()).dns.final,'router-adguard')
  const loop = base(); loop.inbounds.push({type:'direct',tag:'dns',listen:'::',listen_port:20053})
  assert.throws(() => runPlugin('plugin-adguardhome',cfg,loop),/loop/)
  assert.throws(() => runPlugin('plugin-adguardhome',{Enabled:true},base()),/Configure/)
  assert.throws(() => runPlugin('plugin-adguardhome',{Enabled:true,Domains:'bad..domain'},base()),/Invalid AdGuard domain/)
  loop.inbounds[0].listen = '::1'
  assert.throws(() => runPlugin('plugin-adguardhome',{...cfg,Address:'0:0:0:0:0:0:0:1'},loop),/loop/)
  loop.inbounds[0].listen = '0:0:0:0:0:0:0:0'
  assert.throws(() => runPlugin('plugin-adguardhome',{...cfg,Address:'::1'},loop),/loop/)
  assert.throws(() => runPlugin('plugin-adguardhome',{...cfg,Address:'0:0:0:0:0:0:0:0'},base()),/explicit IPv4 or IPv6/)
})
