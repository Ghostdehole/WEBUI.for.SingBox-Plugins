import test from 'node:test';
import assert from 'node:assert/strict';
import {runPlugin} from './helpers.mjs';

const id='plugin-router-urltest';
const base=()=>({outbounds:[{type:'shadowsocks',tag:'one',server:'one.test',server_port:443,method:'aes-128-gcm',password:'test'},{type:'trojan',tag:'two',server:'two.test',server_port:443,password:'test'},{type:'direct',tag:'direct'},{type:'selector',tag:'select',outbounds:['direct','one','two'],default:'one',interrupt_exist_connections:true}],route:{final:'select',rules:[{domain:['nas.lan'],outbound:'direct'}]},inbounds:[],services:[{type:'experimental',tag:'preserve'}]});
const cfg={Enabled:true,Outbounds:'one\ntwo',SelectorTag:'select'};
test('URLTest is opt-in and preserves routing and manual selector default',()=>{
  assert.deepEqual(runPlugin(id,{},base()),base());
  const output=runPlugin(id,cfg,base());
  assert.equal(output.outbounds.at(-1).type,'urltest');
  assert.deepEqual(output.outbounds.at(-1).outbounds,['one','two']);
  assert.equal(output.outbounds[3].default,'one');
  assert.equal(output.outbounds[3].interrupt_exist_connections,true);
  assert.deepEqual(output.route,base().route);
  assert.deepEqual(output.services,base().services);
  assert.equal(base().outbounds.length,4);
});
test('URLTest supports explicit default and is stable across Go JSON key ordering',()=>{
  const config={...cfg,MakeDefault:true,Interval:'5m',IdleTimeout:'1h',Tolerance:'120',InterruptExisting:true};
  const once=runPlugin(id,config,base());
  assert.equal(once.outbounds[3].default,'router-auto');
  assert.equal(once.outbounds.at(-1).tolerance,120);
  const reordered=JSON.parse(JSON.stringify(once,(key,value)=>value && !Array.isArray(value) && typeof value==='object'?Object.fromEntries(Object.entries(value).sort(([a],[b])=>a.localeCompare(b))):value));
  assert.deepEqual(runPlugin(id,config,reordered),once);
});
test('URLTest refuses wrong targets, collisions, invalid options and excessive probes',()=>{
  for(const bad of [{Outbounds:''},{Outbounds:'missing'},{Outbounds:'select'},{Outbounds:'direct'},{Outbounds:'one\none'},{Tag:'one'},{Outbounds:'router-auto'},{SelectorTag:'missing'},{SelectorTag:'one'},{SelectorTag:'',MakeDefault:true},{Interval:'1s'},{Interval:'-1m'},{IdleTimeout:'1m'},{Tolerance:'NaN'},{Tolerance:0.5},{Tolerance:''},{TestURL:'javascript:alert(1)'},{TestURL:'https://secret@example.test/'},{InterruptExisting:'yes'},{Outbounds:Array.from({length:257},(_,i)=>'a'+i)}]) {
    assert.throws(()=>runPlugin(id,{...cfg,...bad},base()),JSON.stringify(bad));
  }
});
test('URLTest catches selector/detour cycles before mutation',()=>{
  const input=base(); input.outbounds[0].detour='select';
  assert.throws(()=>runPlugin(id,cfg,input),/cycle/);
  assert.equal(input.outbounds.length,4);
  const existing=base(); existing.outbounds.push({type:'urltest',tag:'router-auto',outbounds:['one']});
  assert.throws(()=>runPlugin(id,cfg,existing),/already in use/);
});

test('URLTest includes endpoints in tag collision and dependency validation',()=>{
  const cycle=base(); cycle.outbounds[0].detour='wg';
  cycle.endpoints=[{type:'wireguard',tag:'wg',detour:'router-auto'}];
  assert.throws(()=>runPlugin(id,cfg,cycle),/cycle/);
  const collision=base(); collision.endpoints=[{type:'wireguard',tag:'router-auto'}];
  assert.throws(()=>runPlugin(id,cfg,collision),/already in use/);
  const missing=base(); missing.outbounds[0].detour='absent';
  assert.throws(()=>runPlugin(id,cfg,missing),/Unknown outbound dependency/);
  const valid=base(); valid.outbounds[0].detour='wg'; valid.endpoints=[{type:'wireguard',tag:'wg'}];
  assert.deepEqual(runPlugin(id,cfg,valid).endpoints,valid.endpoints);
  assert.throws(()=>runPlugin(id,{...cfg,Outbounds:'wg'},valid),/Choose proxy nodes/);
});
