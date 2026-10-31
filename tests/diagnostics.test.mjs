import test from 'node:test'
import assert from 'node:assert/strict'
import { loadPlugin } from './helpers.mjs'

test('network report observes backend trace and uses bounded HEAD probes without changing nodes', () => {
  const calls=[]
  const result=loadPlugin('plugin-network-info',{Route:'direct',Sites:'[{"name":"Router","url":"http://192.168.8.1/"}]'},{Plugins:{fetch(url,options){
    calls.push({url,options}); return {status:200,body:'ip=192.0.2.1\nloc=ZZ\nwarp=off\n__proto__=bad',elapsed_ms:12,route:options.route,truncated:false}
  }}}).run('onRun')
  assert.deepEqual(result.exit,{ip:'192.0.2.1',loc:'ZZ',warp:'off'})
  assert.equal(result.sites[0].elapsed_ms,12)
  assert.equal(calls[1].options.method,'HEAD')
  assert.equal(calls[1].options.route,'direct')
})
test('diagnostics report outages as errors and reject excess probe requests', () => {
  const plugin=loadPlugin('plugin-network-info',{Sites:'[]'},{Plugins:{fetch(){throw new Error('network unavailable')}}})
  assert.match(plugin.run('onRun').exit.error,/network unavailable/)
  assert.throws(()=>loadPlugin('plugin-network-info',{Sites:JSON.stringify(Array(7).fill({name:'x',url:'https://example.com'}))},{Plugins:{fetch(){return {status:500}}}}).run('onRun'),/six/)
})
test('GeoIP never treats incomplete/provider-error data as a successful lookup', () => {
  const fetch=()=>({status:200,body:JSON.stringify({success:true,ip:'192.0.2.1',country:'Example',connection:{asn:64500}}),route:'core'})
  const result=loadPlugin('plugin-geoip-search',{IP:'192.0.2.1'},{Plugins:{fetch}}).run('onRun')
  assert.equal(result.asn,64500)
  assert.throws(()=>loadPlugin('plugin-geoip-search',{},{Plugins:{fetch:()=>({status:200,truncated:true,body:'{}'})}}).run('onRun'),/incomplete/)
  assert.throws(()=>loadPlugin('plugin-geoip-search',{IP:'https://evil.test'},{Plugins:{fetch}}).run('onRun'),/IP address/)
})
test('media HTTP 200 is not falsely reported as successful playback or full unlock', () => {
  const result=loadPlugin('plugin-media-unlock-checker',{Route:'core'},{Plugins:{fetch(){return {status:200,body:'Login required',route:'core',elapsed_ms:4}}}}).run('onRun')
  assert.equal(result.services.length,3)
  assert.match(result.services[0].observation,/unknown/)
  assert.match(result.services[1].observation,/unknown/)
  const partial=loadPlugin('plugin-media-unlock-checker',{},{Plugins:{fetch(){return {status:200,body:'',truncated:true}}}}).run('onRun')
  assert(partial.services.every(item=>item.observation.startsWith('unknown')))
})
test('download sampling applies a byte budget, preserves partial status and never invokes selector APIs',()=>{
  let call
  const report=loadPlugin('plugin-speedtest',{Route:'direct',Bytes:'65536'},{Plugins:{measureDownload(url,opts){
    call={url,opts};return {bytes:32768,elapsed_ms:100,bytes_per_second:327680,truncated:false,incomplete:true,route:'direct'}
  }}}).run('onRun')
  assert.equal(call.opts.max_bytes,65536)
  assert.equal(call.opts.route,'direct')
  assert.equal(report.incomplete,true)
  assert.equal(report.megabits_per_second,2.621)
  assert.throws(()=>loadPlugin('plugin-speedtest',{Bytes:'999999999'}).run('onRun'),/Sample bytes/)
})
