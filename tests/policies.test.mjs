import test from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { runPlugin } from './helpers.mjs';
const base=()=>({inbounds:[{type:'mixed',tag:'lan',listen:'127.0.0.1',listen_port:1080}],outbounds:[{type:'direct',tag:'direct'},{type:'selector',tag:'proxy',outbounds:['direct']}],dns:{servers:[{type:'udp',tag:'remote',server:'192.0.2.53'},{type:'hosts',tag:'hosts',predefined:{'router.lan':['192.168.8.1']}}],rules:[{domain:['router.lan'],server:'hosts',action:'route'}]},route:{rule_set:[{type:'inline',tag:'example',rules:[{domain_suffix:['example.org']}]}],rules:[{port:[53],action:'hijack-dns'},{domain_suffix:['example.org'],action:'route',outbound:'direct'}]}});
const dns=(rules,input=base(),extra={})=>runPlugin('plugin-dns-policy',{Enabled:true,Rules:JSON.stringify(rules),...extra},input);
const client=(rules,input=base())=>runPlugin('plugin-client-policy',{Enabled:true,Rules:JSON.stringify(rules)},input);
test('policy defaults and empty policy arrays preserve config',()=>{
  for(const id of ['plugin-dns-policy','plugin-client-policy']) {const input=base();assert.deepEqual(runPlugin(id,{},input),input);assert.deepEqual(runPlugin(id,{Enabled:true,Rules:'[]'},input),input);}
  execFileSync(process.execPath,[fileURLToPath(new URL('../scripts/build-policies.mjs',import.meta.url)),'--check']);
});
test('DNS selects existing servers with explicit AND match fields and preserves hosts/final',()=>{
  const input=base();input.dns.final='remote';
  const policy=[{domain_suffix:['example.net'],source_ip_cidr:['192.168.8.0/24'],query_type:['A','AAAA'],server:'remote'}];
  const result=dns(policy,input,{Position:'prepend'});
  assert.equal(result.dns.rules[0].server,'hosts');assert.deepEqual(result.dns.rules[1],{...policy[0],action:'route'});
  assert.equal(result.dns.final,'remote');assert.deepEqual(result.dns.servers,input.dns.servers);
  assert.deepEqual(dns(policy,result,{Position:'prepend'}),result);
});
test('DNS rejects unknown references, catch-all, invalid query type/domain and unexpected fields',()=>{
  for(const entry of [{server:'remote'},{domain:['x.test'],server:'missing'},{domain:['https://x'],server:'remote'},{query_type:['BOGUS'],server:'remote'},{domain:['x.test'],server:'remote',action:'reject'},{rule_set:['missing'],server:'remote'},{inbound:['missing'],server:'remote'}]) assert.throws(()=>dns([entry]));
  assert.throws(()=>dns([{domain:['x.test'],server:'remote'},{domain:['x.test'],server:'hosts'}]),/Duplicate/);
});
test('DNS appends by default and never changes route/inbound or installs rule sets',()=>{
  const input=base();input.dns.rules.push({action:'route',server:'remote'});
  const result=dns([{rule_set:['example'],server:'remote'}],input);
  assert.equal(result.dns.rules.length,3);assert.deepEqual(result.route,input.route);assert.deepEqual(result.inbounds,input.inbounds);
});
test('client policy precedes ordinary routing but keeps DNS hijack and creates no network objects',()=>{
  const input=base(), policy=[{source_ip_cidr:['192.168.8.10/32'],inbound:['lan'],network:['tcp'],port:[443],outbound:'proxy'}];
  const result=client(policy,input);
  assert.equal(result.route.rules[0].action,'hijack-dns');assert.deepEqual(result.route.rules[1],{...policy[0],action:'route'});
  assert.deepEqual(result.inbounds,input.inbounds);assert.deepEqual(result.outbounds,input.outbounds);
  assert.deepEqual(client(policy,result),result);assert.equal(input.route.rules.length,2);
});
test('client policy supports explicit reject and endpoint target but refuses missing references',()=>{
  const input=base();input.endpoints=[{tag:'vpn',type:'wireguard'}];
  assert.equal(client([{source_ip_cidr:['fd00::/64'],outbound:'vpn'}],input).route.rules[1].outbound,'vpn');
  assert.deepEqual(client([{source_ip_cidr:['192.168.8.2/32'],action:'reject'}]).route.rules[1],{source_ip_cidr:['192.168.8.2/32'],action:'reject'});
  for(const entry of [{outbound:'proxy'},{source_ip_cidr:['192.168.8.2'],outbound:'proxy'},{source_ip_cidr:['fd00::/129'],outbound:'proxy'},{source_ip_cidr:['1.2.3.4/32'],outbound:'missing'},{source_ip_cidr:['1.2.3.4/32'],action:'reject',outbound:'proxy'}])assert.throws(()=>client([entry]));
});
test('existing overlapping client rules including nested and IPv6 are refused without input mutation',()=>{
  for(const [source,policySource] of [['192.168.8.0/24','192.168.8.42/32'],['fd00::/64','fd00:0:0:0::2/128'],['::ffff:192.168.8.0/120','::ffff:c0a8:802/128']]) {
    const input=base();input.route.rules.push({type:'logical',mode:'or',rules:[{source_ip_cidr:[source]}],action:'route',outbound:'direct'});const before=structuredClone(input);
    assert.throws(()=>client([{source_ip_cidr:[policySource],outbound:'proxy'}],input),/overlaps/);assert.deepEqual(input,before);
  }
  const input=base();input.route.rules.push({source_ip_cidr:['192.168.9.0/24'],outbound:'direct'});
  assert.equal(client([{source_ip_cidr:['192.168.8.0/24'],outbound:'proxy'}],input).route.rules.length,4);
});
test('legacy TUN ClientRules cannot shadow new client rules in either plugin order',()=>{
  const input=base();input.inbounds=[];
  const rule={source_ip_cidr:['192.168.8.0/24'],outbound:'proxy'};
  const options={Enabled:true,LANInterfaces:'["br-lan"]',Addresses:'["172.19.0.1/30"]',ClientRules:JSON.stringify([rule])};
  const tunFirst=runPlugin('plugin-router-transparent-proxy',options,input);
  assert.throws(()=>client([rule],tunFirst),/overlaps/);
  const clientFirst=client([rule],input);
  assert.throws(()=>runPlugin('plugin-router-transparent-proxy',options,clientFirst),/overlaps/);
  const noLegacy={...options,ClientRules:'[]'};
  assert.equal(runPlugin('plugin-router-transparent-proxy',noLegacy,clientFirst).inbounds.length,1);
});
test('TUN default outbound cannot silently shadow an earlier client policy',()=>{
  const input=base();input.inbounds=[];
  const options={Enabled:true,LANInterfaces:'["br-lan"]',Addresses:'["172.19.0.1/30"]',HijackDNS:true,DefaultOutbound:'proxy'};
  const policies=[{source_ip_cidr:['192.168.8.10/32'],outbound:'direct'}];
  const tunFirst=runPlugin('plugin-router-transparent-proxy',options,input);
  const valid=client(policies,tunFirst);
  const sourceIndex=valid.route.rules.findIndex(r=>r.source_ip_cidr);
  const defaultIndex=valid.route.rules.findIndex(r=>r.inbound?.includes('router-tun')&&r.outbound==='proxy');
  assert(sourceIndex>=0&&sourceIndex<defaultIndex);
  assert.throws(()=>runPlugin('plugin-router-transparent-proxy',options,client(policies,input)),/would shadow/);
});
test('inverted source ranges and ancestor logical inversion are rejected conservatively',()=>{
  for(const existing of [
    {source_ip_cidr:['192.168.8.0/24'],invert:true,action:'route',outbound:'direct'},
    {type:'logical',mode:'and',invert:true,rules:[{source_ip_cidr:['192.168.8.0/24']}],action:'route',outbound:'direct'},
    {type:'logical',mode:'or',rules:[{source_ip_cidr:['192.168.8.0/24'],invert:true}],action:'route',outbound:'direct'},
  ]) {
    const input=base();input.inbounds=[];input.route.rules=[existing];
    const rules=[{source_ip_cidr:['192.168.9.42/32'],outbound:'proxy'}];
    assert.throws(()=>client(rules,input),/inverted source/);
    assert.throws(()=>runPlugin('plugin-router-transparent-proxy',{Enabled:true,LANInterfaces:'["br-lan"]',ClientRules:JSON.stringify(rules)},input),/inverted source/);
  }
});
test('terminal routes interleaved before DNS preprocessing are never silently bypassed',()=>{
  const input=base();input.inbounds=[];input.route.rules=[{action:'route',outbound:'proxy'},{action:'hijack-dns',port:[53]}];
  assert.throws(()=>client([{source_ip_cidr:['192.168.8.10/32'],outbound:'direct'}],input),/terminal routing before DNS/);
  assert.throws(()=>runPlugin('plugin-router-transparent-proxy',{Enabled:true,LANInterfaces:'["br-lan"]',DefaultOutbound:'proxy'},input),/terminal routing before DNS/);
});
