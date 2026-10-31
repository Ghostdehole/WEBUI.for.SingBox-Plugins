function onGenerate(config) {
  if (configuration.Enabled !== true) return config;
  const entries = rulesSetting();
  if (!entries.length) return config;
  const result = copy(config), route = result.route || (result.route = {});
  const known = tags((result.outbounds || []).concat(result.endpoints || []), 'outbounds');
  const generated = [], selectors = new Set();
  entries.forEach(function (entry) {
    const rule = matchFields(entry, result, ['source_ip_cidr', 'inbound', 'ip_cidr', 'domain', 'domain_suffix', 'rule_set', 'network', 'port', 'action', 'outbound']);
    if (!rule.source_ip_cidr) fail('Client policy requires explicit source_ip_cidr');
    const selector = stable(rule);
    if (selectors.has(selector)) fail('Duplicate client policy condition');
    selectors.add(selector);
    const action = entry.action || 'route';
    if (action === 'route') {
      text(entry.outbound, 'outbound');
      if (!known.has(entry.outbound)) fail('Unknown outbound: ' + entry.outbound);
      rule.action = 'route'; rule.outbound = entry.outbound;
    } else if (action === 'reject') {
      if (entry.outbound !== undefined) fail('reject policy must not contain outbound');
      rule.action = 'reject';
    } else fail('Client action must be route or reject');
    generated.push(rule);
  });
  const existing = list(route.rules || [], 'route.rules', 20000);
  const fresh = generated.filter(function (rule) { return !existing.some(function (old) { return stable(old) === stable(rule); }); });
  function sourceConditions(rule, depth, ancestorInvert) {
    if (depth > 64) fail('Existing route rules are too deep');
    if (!object(rule)) fail('Invalid existing route rule');
    const values = rule.source_ip_cidr === undefined ? [] : typeof rule.source_ip_cidr === 'string' ? [rule.source_ip_cidr] : list(rule.source_ip_cidr, 'existing source_ip_cidr', 10000);
    const inverted = ancestorInvert || rule.invert === true;
    if (values.length && inverted) fail('Existing inverted source rule cannot be safely combined; migrate the source policy first');
    values.forEach(cidr);
    return values.concat((rule.rules || []).flatMap(function (child) { return sourceConditions(child, depth + 1, inverted); }));
  }
  existing.forEach(function (old) {
    if (generated.some(function (rule) { return stable(old) === stable(rule); })) return;
    if (old.action === 'hijack-dns' || ['sniff', 'resolve', 'route-options'].includes(old.action)) return;
    const sources = sourceConditions(old, 0);
    if (generated.some(function (rule) { return sources.some(function (oldSource) { return rule.source_ip_cidr.some(function (source) { return overlaps(oldSource, source); }); }); })) fail('Existing client/source rule overlaps this policy; migrate legacy TUN ClientRules or the existing rule first');
  });
  // Keep DNS interception and its preceding rules ahead of client routing.
  let insertion = 0;
  const preludeActions = ['hijack-dns', 'sniff', 'resolve', 'route-options'];
  existing.forEach(function (rule, index) { if (preludeActions.includes(rule.action)) insertion = index + 1; });
  if (existing.slice(0, insertion).some(function (rule) { return !preludeActions.includes(rule.action); })) fail('Existing terminal routing before DNS/preprocessing must be reordered before adding client policies');
  route.rules = existing.slice(0, insertion).concat(fresh, existing.slice(insertion));
  return result;
}
