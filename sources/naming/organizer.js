// Explicit subscription processing, independent of subscription metadata filters.
function organizerList(key) {
  const text = configuration[key];
  if (text === undefined || text === '') return [];
  if (typeof text !== 'string' || text.length > 16384) throw new Error(key + ' must be bounded JSON text');
  let values;
  try { values = JSON.parse(text); } catch (_) { throw new Error(key + ' must be JSON'); }
  if (!Array.isArray(values) || values.length > 64 || values.some(function (v) { return typeof v !== 'string' || !/^[a-z][a-z0-9_-]{0,63}$/.test(v); })) throw new Error(key + ' must contain protocol names');
  return values;
}
function organizerRegex(key) {
  const pattern = configuration[key];
  if (pattern === undefined || pattern === '') return null;
  if (typeof pattern !== 'string' || pattern.length > 512) throw new Error(key + ' must contain at most 512 characters');
  try { return new RegExp(pattern, 'i'); } catch (_) { throw new Error(key + ' is not a valid regular expression'); }
}
function organizerFilter(proxies) {
  const include = organizerRegex('IncludeName'), exclude = organizerRegex('ExcludeName');
  const types = organizerList('IncludeTypes'), denied = organizerList('ExcludeTypes');
  if (!include && !exclude && !types.length && !denied.length) return proxies;
  const originalTags = new Set(proxies.map(function (p) { return p.tag; }));
  const result = proxies.filter(function (p) {
    if (p.type === 'selector' || p.type === 'urltest' || subscriptionNotice(String(p.tag))) return true;
    return (!include || include.test(p.tag)) && (!exclude || !exclude.test(p.tag))
      && (!types.length || types.includes(p.type)) && !denied.includes(p.type);
  });
  if (!result.some(function (p) { return !['selector', 'urltest'].includes(p.type) && !subscriptionNotice(String(p.tag)); })) throw new Error('Filtering removed every usable node; the subscription is unchanged');
  const retained = new Set(result.map(function (p) { return p.tag; }));
  const selected = new Set(result);
  if (proxies.some(function (p) { return !selected.has(p) && retained.has(p.tag); })) throw new Error('Filtering only part of a duplicate name would make references ambiguous; first give these nodes distinct names');
  const removed = function (tag) { return originalTags.has(tag) && !retained.has(tag); };
  result.forEach(function (p) {
    if (removed(p.detour)) throw new Error('Filtering would remove detour ' + p.detour + ' required by ' + p.tag);
    if (Array.isArray(p.outbounds)) {
      p.outbounds = p.outbounds.filter(function (tag) { return !removed(tag); });
      if (!p.outbounds.length) throw new Error('Filtering would empty outbound group ' + p.tag);
      if (removed(p.default)) p.default = p.outbounds[0];
    } else if (removed(p.default)) throw new Error('Filtering would remove default reference ' + p.default);
  });
  console.log('Subscription filter removed ' + (proxies.length - result.length) + ' nodes');
  return result;
}
function organizerDedupe(proxies) {
  const seen = new Map(), aliases = new Map(), result = [];
  const keys = new Map(), tagKeys = new Map();
  proxies.forEach(function (p) {
    const connection = Object.assign({}, p);
    delete connection.tag; delete connection.__id_in_gui; delete connection.id;
    const key = stableValue(connection);
    keys.set(p, key);
    if (!tagKeys.has(p.tag)) tagKeys.set(p.tag, new Set());
    tagKeys.get(p.tag).add(key);
  });
  proxies.forEach(function (p) {
    // Preserve informational entries and structural groups as authored.
    if (['selector', 'urltest'].includes(p.type) || subscriptionNotice(String(p.tag)) || tagKeys.get(p.tag).size > 1) { result.push(p); return; }
    const key = keys.get(p);
    if (seen.has(key)) {
      if (p.tag !== seen.get(key)) aliases.set(p.tag, seen.get(key));
    } else { seen.set(key, p.tag); result.push(p); }
  });
  result.forEach(function (p) {
    ['detour', 'default'].forEach(function (key) { if (aliases.has(p[key])) p[key] = aliases.get(p[key]); });
    if (Array.isArray(p.outbounds)) p.outbounds = Array.from(new Set(p.outbounds.map(function (tag) { return aliases.get(tag) || tag; })));
  });
  console.log('Subscription deduplication removed ' + (proxies.length - result.length) + ' identical nodes');
  return result;
}
function organize(proxies, subscription) {
  if (configuration.Enabled !== true) return proxies;
  let result = JSON.parse(JSON.stringify(proxies));
  if (configuration.FilterEnabled === true) result = organizerFilter(result);
  if (configuration.RemoveDuplicates === true) result = organizerDedupe(result);
  const mode = configuration.RenameMode || 'none';
  if (mode === 'index') result = indexNames(result);
  else if (mode === 'flags') result = flagNames(result);
  else if (mode === 'beautify') result = beautify(result, subscription);
  else if (mode !== 'none') throw new Error('RenameMode must be none, index, flags or beautify');
  return result;
}
function onSubscribe(proxies, subscription) { return organize(proxies, subscription); }
function onRun(proxies, subscription) { return organize(proxies, subscription); }
