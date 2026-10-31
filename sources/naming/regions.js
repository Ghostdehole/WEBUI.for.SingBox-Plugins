// RegionData and its stable-ranked index are derived at build time. Each
// published script stays standalone; fresh Goja hooks do no table sorting,
// keyword case folding, Unicode length calculation or alias regex tests.
function regionRules() {
  return RegionIndex;
}

function regionRegex(rule) {
  if (rule.regex) return rule.regex;
  const escaped = rule.keyword.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  // The existing literal prefilter rejects almost all aliases. Compile only
  // candidates instead of all 907 patterns in every fresh Goja invocation.
  // Explicit word ranges preserve the same Latin-boundary behavior in Goja.
  const letters = 'A-Za-z\\u00c0-\\u02af\\u0370-\\u052f\\u0590-\\u08ff\\u3040-\\u30ff\\u3400-\\u9fff\\uac00-\\ud7af';
  const source = rule.chinese ? escaped : '(^|[^' + letters + '0-9])' + escaped + '(?=[^' + letters + ']|$)';
  rule.regex = new RegExp(source, 'iu');
  return rule.regex;
}

function firstRegionMatch(name, folded, initials, selected) {
  const seen = new Set(), candidates = [];
  // A literal substring must start at a UTF-16 unit present in the name.
  // Keep includes and the original stable rank: case folding, boundaries and
  // country/city precedence are unchanged, including overlapping aliases.
  for (let i = 0; i < folded.length; i++) {
    const initial = folded.charAt(i);
    if (seen.has(initial)) continue;
    seen.add(initial);
    const rules = initials.get(initial);
    if (!rules) continue;
    for (const rule of rules) {
      if ((!selected || rule.region === selected) && folded.includes(rule.folded)) candidates.push(rule);
    }
  }
  candidates.sort(function (a, b) { return a.rank - b.rank; });
  for (const rule of candidates) {
    const match = name.match(regionRegex(rule));
    if (match) return { region: rule.region, text: match[0].slice(rule.chinese ? 0 : (match[1] || '').length), rule: rule };
  }
  return null;
}

function identifyRegion(name) {
  if (subscriptionNotice(name)) return null;
  const rules = regionRules();
  const plain = name.replace(/[\u{1F1E6}-\u{1F1FF}]{2}/gu, ' ');
  const folded = plain.toLowerCase();
  const country = firstRegionMatch(plain, folded, rules.regions);
  const city = firstRegionMatch(plain, folded, rules.cities, country && country.region);
  let region = country && country.region || city && city.region;
  if (!region) {
    const flags = name.match(/[\u{1F1E6}-\u{1F1FF}]{2}/gu) || [];
    for (const flag of flags) { if (rules.emoji.has(flag)) { region = rules.emoji.get(flag); break; } }
  }
  if (!region) return null;
  return { region: region, country: country, city: city };
}

function removeRegionMatch(text, match) {
  return match ? text.replace(match.rule.regex, match.rule.chinese ? ' ' : '$1') : text;
}

function withFlag(name, match) {
  if (!match || /[\u{1F1E6}-\u{1F1FF}]{2}/u.test(name)) return name;
  return match.region.emoji + ' ' + name;
}
