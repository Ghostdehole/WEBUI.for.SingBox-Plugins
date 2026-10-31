function stableValue(value) {
  if (Array.isArray(value)) return '[' + value.map(stableValue).join(',') + ']';
  if (value && typeof value === 'object') return '{' + Object.keys(value).sort().map(function (key) { return JSON.stringify(key) + ':' + stableValue(value[key]); }).join(',') + '}';
  return JSON.stringify(value);
}

function stableNodeKey(proxy) {
  const fields = {};
  // GUI IDs may be regenerated before names are matched back to the old cache.
  // Keep them in the output, but never let them choose a node's serial number.
  Object.keys(proxy).forEach(function (key) { if (!['tag', 'detour', 'default', 'outbounds', '__id_in_gui', 'id'].includes(key)) fields[key] = proxy[key]; });
  return [proxy.server || '', proxy.server_port || '', proxy.type || '', stableValue(fields)].join('\u0000');
}

function beautify(proxies, subscription) {
  subscription = subscription || {};
  const subscriptionName = String(subscription.name || '');
  const prefix = enabled(configuration.EnableSubscriptionName, true) && subscriptionName ? subscriptionName + ' | ' : '';
  const reserved = configuration.ReservedKeywords ? new RegExp(String(configuration.ReservedKeywords), 'gi') : null;
  const counts = new Map();
  const sorted = proxies.map(function (proxy) { return { proxy: proxy, key: stableNodeKey(proxy) }; }).sort(function (a, b) {
    return a.key < b.key ? -1 : a.key > b.key ? 1 : 0;
  }).map(function (item) { return item.proxy; });
  return renameNodes(sorted, function (name) {
    [subscriptionName + ' | ', '[' + subscriptionName + '] '].forEach(function (oldPrefix) {
      if (subscriptionName && name.indexOf(oldPrefix) === 0) name = name.slice(oldPrefix.length);
    });
    name = name.replace(/\s+/g, ' ').trim();
    const match = identifyRegion(name);
    if (!match) return prefix + name;
    const region = match.region;
    let rest = name.replace(/[\u{1F1E6}-\u{1F1FF}]{2}/gu, ' ');
    rest = removeRegionMatch(removeRegionMatch(rest, match.city), match.country);
    const extras = reserved ? Array.from(new Set(rest.match(reserved) || [])) : [];
    const count = (counts.get(region.emoji) || 0) + 1;
    counts.set(region.emoji, count);
    const mode = configuration.EnableUnifyRegionName;
    const label = mode === '统一为英文' ? region.displayNameEn || region.standardName.en
      : mode === '不启用' && match.country ? match.country.text : region.standardName.zh;
    return prefix + [
      enabled(configuration.EnableNationalEmoji, true) ? region.emoji : '',
      label, String(count).padStart(2, '0'),
      enabled(configuration.EnableCityName, true) && match.city ? match.city.text : ''
    ].filter(Boolean).join(' ') + (extras.length ? ' | ' + extras.join(' ') : '');
  });
}

function onSubscribe(proxies, subscription) { return beautify(proxies, subscription); }
function onRun(proxies, subscription) {
  const result = beautify(proxies, subscription);
  console.log('Updated names for ' + result.length + ' nodes.');
  return result;
}
