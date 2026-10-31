# Naming plugin sources

The region data and aliases are adapted from **GUI.for.Cores and the GUI-for-Cores/Plugin-Hub contributors**, whose package.json identifies the author as GUI.for.Cores and license as GPL-3.0. The upstream snapshot is commit `205ecacb0742a185947252cb91e5b11541c32a94`:

- [RegionData and naming behaviour](https://github.com/GUI-for-Cores/Plugin-Hub/blob/205ecacb0742a185947252cb91e5b11541c32a94/plugins/Generic/plugin-beautiful-node-name.js)
- [Additional aliases and flag behaviour](https://github.com/GUI-for-Cores/Plugin-Hub/blob/205ecacb0742a185947252cb91e5b11541c32a94/plugins/Generic/plugin-modify-proxy-name.js)
- [Index naming behaviour](https://github.com/GUI-for-Cores/Plugin-Hub/blob/205ecacb0742a185947252cb91e5b11541c32a94/plugins/Generic/plugin-index-the-proxy-name.js)
- [Author/license declaration](https://github.com/GUI-for-Cores/Plugin-Hub/blob/205ecacb0742a185947252cb91e5b11541c32a94/package.json)

The full upstream RegionData is retained (142 region entries), supplemented with nonconflicting aliases from the flag plugin and names/cities supported by this repository's previous release. The flag alias table's Seville/Sevilla assignment is not copied over the RegionData assignment to Spain. The negative-lookbehind BR alias becomes a literal BR keyword with word boundaries. Existing Taiwan flag output and the previous ten English display names are retained; upstream displayEmoji remains recorded in the data but is not used to override existing output.

Backend adaptation by WEBUI.for.SingBox-Plugins contributors: stable JSON node fields and IDs, internal-reference updates, stable repeated execution, subscription notices, no duplicate subscription filtering, no desktop UI/store access and no downloaded executable JavaScript. These files and the generated naming scripts are distributed under GPL-3.0-only; see the repository LICENSE. This does not expand the upstream GPL-3.0 declaration to an "or later" grant.

Run `node scripts/build-naming.mjs` after editing these files, or `node scripts/build-naming.mjs --check` to verify committed generated scripts. Each generated plugin is self-contained at runtime and performs no network requests. Index naming does not need or embed the region table.

From the 1.4 catalog, the three naming modes are also compiled into `plugin-subscription-organizer` with `node scripts/build-organizer.mjs` (or `--check`). The old IDs remain compatibility entries; no installed script is automatically replaced. The organizer adds explicitly configured name/protocol filtering and full-connection deduplication, independently of subscription metadata filters. This additional pipeline is maintained in `organizer.js`; see `docs/migration-1.4.md` for ordering and repeat-execution limits.
