// SPDX-License-Identifier: GPL-3.0-only
// Consolidates Plugin-Hub network-info, ip-geolocation and geoip-search needs.
// Source: GUI-for-Cores/Plugin-Hub @ 205ecacb0742a185947252cb91e5b11541c32a94.
// Explicit diagnostics only: bounded requests, no selector or configuration changes.
function onRun() {
  const route = configuration.Route || 'configured';
  if (!['configured', 'direct', 'core'].includes(route)) throw new Error('Unknown request route');
  const report = { route: route, exit: null, ip_lookup: null, sites: [], note: 'Router backend observations only; LAN paths, geolocation accuracy and media unlock are not guaranteed.' };
  let sites;
  try { sites = JSON.parse(configuration.Sites || '[]'); } catch (_) { throw new Error('Sites must be valid JSON'); }
  if (!Array.isArray(sites) || sites.length > 6) throw new Error('Sites must contain at most six {name,url} entries');
  sites.forEach(function (site) {
    if (!site || typeof site !== 'object' || Array.isArray(site) || Object.keys(site).some(function (key) { return !['name', 'url'].includes(key); }) || typeof site.name !== 'string' || !site.name.trim() || site.name.length > 128 || typeof site.url !== 'string' || site.url.length > 2048 || !/^https?:\/\//i.test(site.url)) throw new Error('Each site requires a name and an HTTP(S) URL');
  });
  const ip = String(configuration.IP || '').trim();
  if (configuration.LookupIP === true && ip && !diagnosticIP(ip)) throw new Error('IP must be an address, not a hostname or URL');
  if (configuration.CheckExit !== false) {
    try {
      const response = Plugins.fetch('https://www.cloudflare.com/cdn-cgi/trace', { route: route });
      if (response.status !== 200 || response.truncated) throw new Error('Exit trace is incomplete or unsuccessful');
      const trace = {};
      response.body.split(/\r?\n/).forEach(function (line) {
        const point = line.indexOf('='), key = line.slice(0, point);
        if (['ip', 'loc', 'colo', 'warp', 'tls', 'http'].includes(key)) trace[key] = line.slice(point + 1);
      });
      if (!trace.ip) throw new Error('Exit trace did not return an IP');
      report.exit = trace;
    } catch (error) { report.exit = { error: String(error.message || error) }; }
  }
  if (configuration.LookupIP === true) {
    try {
      // An empty IP asks the provider about this request's exit; do not silently
      // reuse the Cloudflare address when endpoints may use different routes.
      const response = Plugins.fetch('https://ipwho.is/' + encodeURIComponent(ip), { route: route });
      if (response.status !== 200 || response.truncated) throw new Error('IP lookup is incomplete or unsuccessful');
      const value = JSON.parse(response.body);
      if (value.success !== true || typeof value.ip !== 'string') throw new Error('IP provider did not return a successful result');
      report.ip_lookup = {
        provider: 'ipwho.is', ip: value.ip, type: value.type,
        country: value.country, country_code: value.country_code, region: value.region, city: value.city,
        asn: value.connection && value.connection.asn, isp: value.connection && value.connection.isp,
      };
    } catch (error) { report.ip_lookup = { error: String(error.message || error) }; }
  }
  sites.forEach(function (site) {
    const item = { name: site.name };
    try {
      const response = Plugins.fetch(site.url, { method: 'HEAD', route: route });
      item.status = response.status; item.elapsed_ms = response.elapsed_ms;
      item.reachable = response.status >= 200 && response.status < 400;
    } catch (error) { item.error = String(error.message || error); }
    report.sites.push(item);
  });
  return report;
}
function diagnosticIP(input) {
  function v4(ip) {
    const parts = ip.split('.');
    return parts.length === 4 && parts.every(function (v) { return /^(0|[1-9]\d{0,2})$/.test(v) && Number(v) < 256; });
  }
  if (!input.includes(':')) return v4(input);
  if (input.length > 45 || !/^[a-f0-9:.]+$/i.test(input) || input.includes(':::')) return false;
  let ip = input;
  if (ip.includes('.')) {
    const point = ip.lastIndexOf(':');
    if (!v4(ip.slice(point + 1))) return false;
    ip = ip.slice(0, point + 1) + '0:0';
  }
  const halves = ip.split('::');
  if (halves.length > 2) return false;
  const left = halves[0] ? halves[0].split(':') : [];
  const right = halves.length === 2 && halves[1] ? halves[1].split(':') : [];
  const count = left.length + right.length;
  return (halves.length === 1 ? count === 8 : count < 8) && left.concat(right).every(function (v) { return /^[a-f0-9]{1,4}$/i.test(v); });
}
