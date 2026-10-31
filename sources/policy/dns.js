function onGenerate(config) {
  if (configuration.Enabled !== true) return config;
  const entries = rulesSetting();
  if (!entries.length) return config;
  const result = copy(config);
  const dns = result.dns || (result.dns = {});
  const known = tags(dns.servers, 'DNS servers');
  const generated = [], selectors = new Set();
  entries.forEach(function (entry) {
    const rule = matchFields(entry, result, ['domain', 'domain_suffix', 'source_ip_cidr', 'inbound', 'rule_set', 'query_type', 'server']);
    if (entry.query_type !== undefined) {
      rule.query_type = strings(entry.query_type, 'query_type');
      if (rule.query_type.some(function (v) { return !['A', 'AAAA', 'HTTPS', 'SVCB', 'TXT', 'MX', 'PTR', 'SRV', 'NS', 'CNAME'].includes(v); })) fail('Unsupported DNS query_type');
    }
    if (!Object.keys(rule).length) fail('DNS policy needs an explicit match; configure dns.final directly for a catch-all');
    const selector = stable(rule);
    if (selectors.has(selector)) fail('Duplicate DNS policy condition');
    selectors.add(selector);
    text(entry.server, 'DNS server');
    if (!known.has(entry.server)) fail('Unknown DNS server: ' + entry.server);
    rule.action = 'route'; rule.server = entry.server;
    generated.push(rule);
  });
  const existing = list(dns.rules || [], 'dns.rules', 20000);
  const fresh = generated.filter(function (rule) { return !existing.some(function (old) { return stable(old) === stable(rule); }); });
  const position = configuration.Position || 'append';
  if (!['append', 'prepend'].includes(position)) fail('Position must be append or prepend');
  if (position === 'append') dns.rules = existing.concat(fresh);
  else {
    // Preserve existing hosts precedence without moving any existing rule.
    const hosts = new Set((dns.servers || []).filter(function (v) { return v.type === 'hosts'; }).map(function (v) { return v.tag; }));
    let insertion = 0;
    existing.forEach(function (rule, index) { if (hosts.has(rule.server)) insertion = index + 1; });
    dns.rules = existing.slice(0, insertion).concat(fresh, existing.slice(insertion));
  }
  return result;
}
