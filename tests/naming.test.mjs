import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import {execFileSync} from 'node:child_process';
import {fileURLToPath} from 'node:url';
import {loadPlugin} from './helpers.mjs';
import {renderRegionIndex} from '../scripts/region-index.mjs';

const ids = ['plugin-index-the-proxy-name', 'plugin-modify-proxy-name', 'plugin-beautiful-node-name'];
const regions = JSON.parse(fs.readFileSync(new URL('../sources/naming/region-data.json', import.meta.url)));
const node = (tag, extras={}) => ({type:'shadowsocks', tag, id:tag, server:'example.test', server_port:443, method:'aes-128-gcm', password:'example', ...extras});
const run = (id, config, data, sub={}) => loadPlugin(id, config).run('onSubscribe', data, sub);

test('generated standalone sources match the maintained offline fragments', () => {
  execFileSync(process.execPath, [fileURLToPath(new URL('../scripts/build-naming.mjs', import.meta.url)), '--check']);
});

test('region patterns are compiled only for literal candidates and reused in one invocation', () => {
  for (const id of [ids[1], ids[2], 'plugin-subscription-organizer']) {
    let compiled = 0;
    function CountedRegExp(pattern, flags) { compiled++; return new RegExp(pattern, flags); }
    const plugin = loadPlugin(id, {Enabled:true,RenameMode:'flags'}, {RegExp:CountedRegExp});
    plugin.run('onSubscribe', [node('qzxqzx')], {});
    assert.equal(compiled, 0, id + ': unmatched names must not compile the region table');
    plugin.run('onSubscribe', [node('France node')], {});
    assert.equal(compiled, 1, id + ': only the France alias is a candidate');
    plugin.run('onSubscribe', [node('France node')], {});
    assert.equal(compiled, 1, id + ': reuse the matching alias within this VM');
  }
});

test('indexed matching equals the previous algorithm for all 907 aliases and Unicode boundaries', () => {
  const names = [];
  for (const region of regions) {
    for (const keyword of [...region.keywords, ...region.subKeywords]) {
      names.push(keyword, keyword + '01', 'X' + keyword + 'Y', '🇯🇵 ' + keyword,
        'HK ' + keyword + ' Paris', keyword.toUpperCase(), 'İ𐐀\ud800 ' + keyword + ' 01');
    }
  }
  assert.equal(names.length, 907 * 7);
  names.push('HK Paris', 'France Kowloon', '🇭🇰 Tokyo', '🇯🇵 France', 'HAPPY', 'LOGIN',
    'İstanbul', '剩余流量100 GB', 'remaining traffic: 100 GB', 'qzxqzx', '', '🇫🇷');
  const shared = fs.readFileSync(new URL('../sources/naming/shared.js', import.meta.url), 'utf8');
  const inspect = `JSON.stringify(names.map(function(name) {
    const match=identifyRegion(name);
    return match ? [match.region.emoji, match.country && match.country.text,
      match.city && match.city.text, withFlag(name,match),
      removeRegionMatch(removeRegionMatch(name,match.city),match.country)] : null;
  }))`;
  const evaluate = path => {
    const context = vm.createContext({names}, {codeGeneration:{strings:false,wasm:false}});
    const matcher = fs.readFileSync(new URL(path, import.meta.url), 'utf8');
    return JSON.parse(vm.runInContext(shared + '\nconst RegionData=' + JSON.stringify(regions) + ';\n' + renderRegionIndex(regions) + '\n' + matcher + '\n' + inspect, context, {timeout:10000}));
  };
  const expected = evaluate('./fixtures/naming-regions-before-index.js');
  const actual = evaluate('../sources/naming/regions.js');
  for (let i=0; i<names.length; i++) assert.deepEqual(actual[i],expected[i],names[i]);
});

test('all 142 official regions are recognized by name without network or host APIs', () => {
  assert.equal(regions.length, 142);
  for (const region of regions) {
    const [flagged] = run(ids[1], {}, [node(region.standardName.zh + ' 01')]);
    assert.ok(flagged.tag.startsWith(region.emoji + ' '), region.standardName.zh + ': ' + flagged.tag);
    const [beautiful] = run(ids[2], {}, [node(region.standardName.zh + ' 01')]);
    assert.equal(beautiful.tag, region.emoji + ' ' + region.standardName.zh + ' 01');
  }
});

test('longer aliases, city aliases, Latin boundaries, flags and notices are handled', () => {
  for (const [name, flag] of [['North Korea01','🇰🇵'],['United States Virgin Islands','🇻🇮'],['GBR01','🇬🇧'],['Sevilla','🇪🇸'],['Kowloon','🇭🇰'],['Frankfurt','🇩🇪'],['墨爾本','🇦🇺'],['Lagos','🇳🇬'],['Reunion','🇷🇪']]) {
    assert.ok(run(ids[1],{},[node(name)])[0].tag.startsWith(flag+' '), name);
  }
  for (const name of ['HAPPY','LOGIN','CANDY','TWIN','remaining traffic: 100 GB','🧾 剩余流量: 100 GB','剩余流量100 GB','官网: https://example.com','unknown-01']) {
    assert.equal(run(ids[1],{},[node(name)])[0].tag,name);
  }
  assert.equal(run(ids[1],{},[node('🇹🇼 Taiwan')])[0].tag,'🇹🇼 Taiwan');
});

test('all naming scripts preserve IDs, credentials, fields and remap internal references', () => {
  const input = [node('HK01',{id:'node-id',tls:{server_name:'HK01'}}),node('JP01',{id:'other-id',detour:'HK01'}),{id:'group-id',type:'selector',tag:'group',outbounds:['HK01','JP01','external'],default:'JP01'}];
  for (const id of ids) {
    const output = run(id,{},input);
    const byID = Object.fromEntries(output.map(x=>[x.id,x]));
    assert.equal(byID['node-id'].password,'example');
    assert.equal(byID['node-id'].tls.server_name,'HK01');
    assert.equal(byID['other-id'].detour,byID['node-id'].tag);
    assert.deepEqual(byID['group-id'].outbounds,[byID['node-id'].tag,byID['other-id'].tag,'external']);
    assert.equal(byID['group-id'].default,byID['other-id'].tag);
    assert.deepEqual(input[0].tag,'HK01');
  }
});

test('repeated execution is stable including serials, duplicates, metadata and same-server nodes', () => {
  const input = [node('HK_01',{id:'b',password:'b'}),node('HK_01',{id:'a',password:'a'}),node('France Paris BGP 2x',{id:'c'}),node('unknown',{id:'d'})];
  for (const [id,configuration] of [[ids[0],{}],[ids[1],{EnableIndexProxyName:'1'}],[ids[1],{EnableIndexProxyName:'2'}],[ids[2],{ReservedKeywords:'BGP|IEPL|IPLC|(\\d+(?:\\.\\d+)?)[xX]'}]]) {
    const sub={name:'Sub',include:'NO MATCH',exclude:'.*',includeProtocol:'reject'};
    const once=run(id,configuration,input,sub);
    assert.equal(once.length,input.length);
    assert.deepEqual(run(id,configuration,once,sub),once,id);
    assert.equal(new Set(once.map(x=>x.tag)).size,once.length);
  }
});

test('legacy parameter values, no-index mode, city names and manual cached execution remain compatible', () => {
  const noFlags={EnableAddEmoji:0,EnableIndexProxyName:'0'};
  assert.deepEqual(run(ids[1],noFlags,[node('France'),node('France')]).map(x=>x.tag),['France','France']);
  assert.equal(run(ids[1],{EnableAddEmoji:false,EnableRemoveKeywords:true,RemoveKeywords:'^PREFIX-'},[node('PREFIX-France')])[0].tag,'France');
  const config={EnableSubscriptionName:false,EnableNationalEmoji:false,EnableUnifyRegionName:'统一为英文',EnableCityName:true,ReservedKeywords:'BGP|2x'};
  const input=[node('HK Kowloon BGP 2x')];
  const output=run(ids[2],config,input,{name:'Subscription'});
  assert.equal(output[0].tag,'Hong Kong 01 Kowloon | BGP 2x');
  assert.deepEqual(loadPlugin(ids[2],config).run('onRun',input,{name:'Subscription'}),output);
  assert.equal(run(ids[2],{EnableCityName:false},[node('HK Kowloon')])[0].tag,'🇭🇰 香港 01');
  assert.throws(()=>run(ids[1],{EnableRemoveKeywords:true,RemoveKeywords:'['},input));
});

test('fresh GUI IDs cannot exchange names between same-server nodes with different credentials', () => {
  const first=[node('HK A',{id:'gui-a',__id_in_gui:'old-a',password:'secret-b'}),node('HK B',{id:'gui-z',__id_in_gui:'old-z',password:'secret-a'})];
  const refreshed=first.map((proxy,i)=>({...proxy,id:i?'new-a':'new-z',__id_in_gui:i?'fresh-a':'fresh-z'})).reverse();
  const a=run(ids[2],{},first);
  const b=run(ids[2],{},refreshed);
  assert.deepEqual(a.map(p=>[p.password,p.tag]),b.map(p=>[p.password,p.tag]));
  assert.deepEqual(a.map(p=>p.password),['secret-a','secret-b']);
  for(const p of b) assert.equal(p.__id_in_gui,refreshed.find(source=>source.password===p.password).__id_in_gui);
});
