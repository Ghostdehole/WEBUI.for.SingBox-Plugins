import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { loadPlugin } from './helpers.mjs';
const id = 'plugin-subscription-organizer';
const node = (tag, extra={}) => ({type:'shadowsocks',tag,__id_in_gui:tag,server:'example.test',server_port:443,method:'aes-128-gcm',password:'one',...extra});
const run = (configuration,input,sub={}) => loadPlugin(id,configuration).run('onSubscribe',input,sub);

test('organizer defaults are no-op and generated script is reproducible', () => {
  const input=[node('HK'),node('HK')];
  assert.deepEqual(run({},input),input);
  execFileSync(process.execPath,[fileURLToPath(new URL('../scripts/build-organizer.mjs',import.meta.url)),'--check']);
});
test('all three legacy naming modes reproduce old options and retain IDs/references',()=>{
  const input=[node('HK'),node('Tokyo',{password:'two',detour:'HK'}),{type:'selector',tag:'group',outbounds:['HK','Tokyo'],default:'Tokyo',__id_in_gui:'g'}];
  for(const [RenameMode,old] of [['index','index-the-proxy-name'],['flags','modify-proxy-name'],['beautify','beautiful-node-name']]) {
    const config={Enabled:true,RenameMode,EnableSubscriptionName:false,EnableIndexProxyName:'2'};
    const result=run(config,input,{name:'Sub'});
    assert.deepEqual(result,loadPlugin('plugin-'+old,config).run('onSubscribe',input,{name:'Sub'}));
    assert.deepEqual(run(config,result,{name:'Sub'}),result);
    assert.equal(result.find(p=>p.__id_in_gui==='Tokyo').detour,result.find(p=>p.__id_in_gui==='HK').tag);
  }
});
test('organizer protocol filtering repairs groups and ignores subscription metadata filters',()=>{
  const input=[node('HK'),node('VM',{type:'vmess'}),{type:'selector',tag:'group',outbounds:['HK','VM','external'],default:'VM'},node('剩余流量: 100 GB',{type:'direct'})];
  const config={Enabled:true,FilterEnabled:true,IncludeTypes:'["shadowsocks"]'};
  const result=run(config,input,{include:'NO MATCH',exclude:'.*',excludeProtocol:'.*'});
  assert.deepEqual(result.map(p=>p.tag),['HK','group','剩余流量: 100 GB']);
  assert.deepEqual(result[1].outbounds,['HK','external']);assert.equal(result[1].default,'HK');
  assert.deepEqual(run(config,result),result);assert.equal(input[2].default,'VM');
});
test('filtering refuses empty subscriptions, empty groups, detour loss and ambiguous duplicate references',()=>{
  const config={Enabled:true,FilterEnabled:true,ExcludeName:'remove'};
  assert.throws(()=>run(config,[node('remove')]),/every usable/);
  assert.throws(()=>run(config,[node('keep',{detour:'remove'}),node('remove')]),/detour/);
  assert.throws(()=>run(config,[node('keep'),node('remove'),{type:'selector',tag:'g',outbounds:['remove']}]),/empty outbound/);
  assert.throws(()=>run({...config,ExcludeName:'',IncludeTypes:'["shadowsocks"]'},[node('same'),node('same',{type:'vmess'})]),/ambiguous/);
});
test('deduplication preserves different credentials and rewrites retained references',()=>{
  const input=[node('A'),node('copy'),node('other',{password:'two'}),node('via',{password:'three',detour:'copy'}),{type:'selector',tag:'g',outbounds:['A','copy','other'],default:'copy'}];
  const config={Enabled:true,RemoveDuplicates:true};
  const result=run(config,input);
  assert.deepEqual(result.map(p=>p.tag),['A','other','via','g']);
  assert.equal(result[2].detour,'A');assert.deepEqual(result[3].outbounds,['A','other']);assert.equal(result[3].default,'A');
  assert.deepEqual(run(config,result),result);assert.equal(result[0].__id_in_gui,'A');
});
test('invalid optional filters are ignored while disabled and rejected only on explicit enable',()=>{
  const input=[node('HK')];
  assert.deepEqual(run({Enabled:true,FilterEnabled:false,IncludeName:'[',IncludeTypes:'bad'},input),input);
  assert.throws(()=>run({Enabled:true,FilterEnabled:true,IncludeName:'['},input),/regular expression/);
  assert.throws(()=>run({Enabled:true,FilterEnabled:true,IncludeTypes:'["SS"]'},input),/protocol names/);
});
test('current and compatibility catalogs have explicit complete replacement conflicts',()=>{
  const entries=JSON.parse(fs.readFileSync(new URL('../index.json',import.meta.url))).plugins;
  assert.equal(entries.filter(p=>!p.deprecated).length,14);assert.equal(entries.filter(p=>p.deprecated).length,6);
  const byId=new Map(entries.map(p=>[p.id,p]));
  for(const legacy of entries.filter(p=>p.deprecated)) {
    const replacement=byId.get(legacy.replaced_by);
    assert(replacement&&!replacement.deprecated);assert(legacy.conflicts.includes(replacement.id));assert(replacement.conflicts.includes(legacy.id));
  }
});
