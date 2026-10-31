// RegionData is inlined from region-data.json by scripts/build-naming.mjs.
let compiledRegions;
function regionRules() {
  if (compiledRegions) return compiledRegions;
  const regions = [], cities = [], emoji = new Map();
  function add(rules, keyword, region) {
    rules.push({ keyword: keyword, folded: keyword.toLowerCase(), region: region, regex: null,
      chinese: /[\u3400-\u9fff]/.test(keyword), length: Array.from(keyword).length });
  }
  RegionData.forEach(function (region) {
    emoji.set(region.emoji, region);
    region.keywords.forEach(function (keyword) { add(regions, keyword, region); });
    region.subKeywords.forEach(function (keyword) { add(cities, keyword, region); });
  });
  const longest = function (a, b) { return b.length - a.length; };
  regions.sort(longest); cities.sort(longest);
  compiledRegions = { regions: regions, cities: cities, emoji: emoji };
  return compiledRegions;
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

function firstRegionMatch(name, rules, selected) {
  const folded = name.toLowerCase();
  for (const rule of rules) {
    if (selected && rule.region !== selected) continue;
    if (!folded.includes(rule.folded)) continue;
    const match = name.match(regionRegex(rule));
    if (match) return { region: rule.region, text: match[0].slice(rule.chinese ? 0 : (match[1] || '').length), rule: rule };
  }
  return null;
}

function identifyRegion(name) {
  if (subscriptionNotice(name)) return null;
  const rules = regionRules();
  const plain = name.replace(/[\u{1F1E6}-\u{1F1FF}]{2}/gu, ' ');
  const country = firstRegionMatch(plain, rules.regions);
  const anyCity = firstRegionMatch(plain, rules.cities);
  let region = country && country.region || anyCity && anyCity.region;
  if (!region) {
    const flags = name.match(/[\u{1F1E6}-\u{1F1FF}]{2}/gu) || [];
    for (const flag of flags) { if (rules.emoji.has(flag)) { region = rules.emoji.get(flag); break; } }
  }
  if (!region) return null;
  return { region: region, country: country && country.region === region ? country : null, city: firstRegionMatch(plain, rules.cities, region) };
}

function removeRegionMatch(text, match) {
  return match ? text.replace(match.rule.regex, match.rule.chinese ? ' ' : '$1') : text;
}

function withFlag(name, match) {
  if (!match || /[\u{1F1E6}-\u{1F1FF}]{2}/u.test(name)) return name;
  return match.region.emoji + ' ' + name;
}
