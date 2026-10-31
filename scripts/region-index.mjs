// Pure build-time derivatives of the attributed upstream region-data.json.
export function renderRegionIndex(data) {
  function index(key) {
    const rules = data.flatMap((region, regionIndex) => region[key].map(keyword => ({
      keyword, folded:keyword.toLowerCase(), region:regionIndex,
      chinese:/[\u3400-\u9fff]/.test(keyword), length:Array.from(keyword).length
    }))).sort((a,b) => b.length-a.length);
    const groups = new Map();
    rules.forEach((rule, rank) => {
      const initial = rule.folded.charAt(0);
      if (!groups.has(initial)) groups.set(initial, []);
      groups.get(initial).push('{keyword:' + JSON.stringify(rule.keyword)
        + ',folded:' + JSON.stringify(rule.folded) + ',region:RegionData[' + rule.region + ']'
        + ',chinese:' + rule.chinese + ',rank:' + rank + ',regex:null}');
    });
    return 'new Map([' + [...groups].map(([initial, rules]) => '[' + JSON.stringify(initial) + ',[' + rules.join(',') + ']]').join(',') + '])';
  }
  return '// BEGIN GENERATED REGION INDEX\nconst RegionIndex = {regions:' + index('keywords')
    + ',cities:' + index('subKeywords') + ',emoji:new Map(['
    + data.map((region,i) => '[' + JSON.stringify(region.emoji) + ',RegionData[' + i + ']]').join(',')
    + '])};\n// END GENERATED REGION INDEX\n';
}
