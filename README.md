# WEBUI.for.SingBox 插件中心

为 [Ghostdehole/WEBUI.for.SingBox](https://github.com/Ghostdehole/WEBUI.for.SingBox) 独立维护的 JavaScript 插件仓库，面向路由器、网关和透明代理。**本仓库是插件中心唯一发行来源**，清单与源码只在此维护；主程序提供下载、管理和执行接口，不复制或打包插件发行源码。插件在顶部「插件」页面管理，由 Go 后端执行，订阅定时更新不依赖浏览器保持打开。

**请先升级主程序至 WEBUI.for.SingBox 1.4.0 或更新版本，再从本仓库获取插件。** 1.4.0 提供路由器插件管理与执行接口；1.3.1 已取消主程序随附插件。配置生成以 sing-box 1.14.x 为基线；插件版本独立，不表示主程序或 Release 版本。

已审阅并重新核对官方 [Plugin-Hub](https://github.com/GUI-for-Cores/Plugin-Hub) 的全部 **100 个插件入口**。当前目录按用途提供 **14 个插件**；六个旧独立包已从目录和源码发行中移除；包含合并和部分能力替代，**并非全功能复刻**。逐项取舍见 [中文审计](docs/upstream-review.md)，固定提交和逐文件 SHA256 见 [审计 JSON](upstream/audit.json)。官方桌面 JS 不能直接导入运行。

## 插件列表

| 插件 | 触发方式 | 本轮能力与边界 |
| --- | --- | --- |
| [订阅节点整理](plugins/plugin-subscription-organizer.js) | 订阅更新 / 手动订阅 | 统一可选命名、去重、名称/协议筛选；保留节点身份与内部引用，默认关闭 |
| [DNS 分流策略](plugins/plugin-dns-policy.js) | 生成配置 | 匹配域名、客户端来源、查询类型或已有规则集，选择已有解析器；不改系统 DNS |
| [客户端分流策略](plugins/plugin-client-policy.js) | 生成配置 | 明确来源 CIDR 的出站选择/拒绝；保留 DNS 劫持优先，拒绝与旧来源规则重叠 |
| [路由器 Hosts DNS](plugins/plugin-hosts-management.js) | 生成配置 | 增加 sing-box DNS hosts 映射，不覆盖 `/etc/hosts` |
| [AdGuardHome DNS 对接](plugins/plugin-adguardhome.js) | 生成配置 | 对接已运行的 DNS 服务，不安装、升级或启动 AdGuardHome |
| [网络诊断](plugins/plugin-network-diagnostics.js) | 手动诊断 | 按需组合出口 trace、显式 IP 地区/运营商查询、最多六站点 HEAD 检查；不切节点 |
| [流媒体可达性诊断](plugins/plugin-media-unlock-checker.js) | 手动诊断 | Netflix、YouTube Premium、Spotify 的有限只读观察，不把 HTTP 200 当作完整解锁 |
| [路由器限量下载测速](plugins/plugin-speedtest.js) | 手动诊断 | 当前出口 64 KiB–8 MiB 流式样本，不落盘、不切换节点、不做批量排名 |
| [出站链管理](plugins/plugin-outbound-chain-manager.js) | 生成配置 | 合并节点/分组 detour 链路，校验依赖环和既有设置冲突 |
| [配置覆盖](plugins/plugin-config-override.js) | 生成配置 | 受限 JSON 深合并/数组追加，保护管理接口和现有监听，不加载远端脚本 |
| [按需引用规则集](plugins/plugin-add-rulesets.js) | 生成配置 | 仅引用所选 sing-box 规则集，可附加路由；不整库安装或转换 Clash YAML/MRS |
| [路由器透明代理](plugins/plugin-router-transparent-proxy.js) | 生成配置 | 显式 LAN 接口、TUN、排除网段与可选 DNS 劫持；旧 ClientRules 保留读取并明确迁移 |
| [路由器独立代理端口](plugins/plugin-router-listeners.js) | 生成配置 | HTTP/SOCKS/mixed 入站绑定出站或沿用全局路由；LAN 监听需明确认证配置 |
| [核心自动测速选择](plugins/plugin-router-urltest.js) | 生成配置 | 核心 URLTest 探测选择；不等价 EWMA 智能评分、日志错误阈值或按序故障转移 |

命名表覆盖 **142 个地区、907 个国家/地区/城市关键词和兼容别名**，来源与调整见 [命名说明](sources/naming/NOTICE.md)。只根据节点名称识别，不查询 IP；未知名称和流量/到期提示保留。美化排序不受临时 GUI ID 影响。原始同名引用无法区分时指向第一个同名节点；配置中手工填写的旧 tag 仍需检查。

## 安装、升级与应用

1. 升级主程序至 **1.4.0+**，打开「插件 → 插件中心」。有有效目录缓存时先显示缓存，没有缓存时只获取本仓库的 `index.json` 元数据列表；「检查更新」也只刷新列表，不下载 JS、不安装插件。选择所需插件并点击「安装」，才下载该插件源码，通过 SHA256 和语法校验后保存。列表获取失败且无缓存时显示空目录和警告，不会出现主程序内置目录。
2. 目录只提供 14 个当前插件，不再提供六个旧包的安装、更新或兼容入口。主程序会过滤已缓存的旧条目。**迁移前导出旧参数、在插件页禁用旧项，再安装新项并明确配置。** 不会自动迁移、禁用或删除旧安装；新旧互斥避免重复处理。参数对应、回退与 TUN `ClientRules` 迁移见 [1.4 迁移说明](docs/migration-1.4.md)。
3. 安装、编辑、更新本身不执行脚本。「设置 → 插件」提供开关、单选、输入和多行 JSON 参数并自动保存；更多菜单提供高级 JSON、触发器、启停、顺序和删除，源码可查看、修改、导入导出。
4. **十个配置插件默认不生效**：Hosts、AdGuardHome、覆盖、TUN、URLTest、DNS/客户端策略的 `Enabled` 关闭；链路、规则集和独立端口的列表默认为 `[]`。订阅整理也默认关闭。填写实际接口/tag/地址后，再开启对应功能。
5. 更新订阅时执行已启用的订阅整理；手动整理需选择已有缓存的订阅。三个当前诊断插件直接返回报告，不选择订阅、不写缓存、不改当前 selector。DNS/客户端策略的字段、优先级与边界见 [策略说明](docs/policies.md)。
6. 配置插件只改变生成结果。先预览并检查配置，**保存后按需手动重启核心**。浏览器关闭不会停止核心自己的 URLTest。

点击某插件「更新」才下载该项新源码，经 SHA256 和语法校验后替换已安装版本；下载或校验失败保留原版本。更新保留参数、启停、触发器和顺序，会覆盖本地源码修改，独立定制建议使用新 ID。目录刷新只校验并缓存元数据，失败保留有效缓存并提示，没有缓存则保持空目录。

目录缓存只用于浏览列表，不含 JS；离线时不能从中心新安装或更新插件。已安装源码独立保存，可离线执行，目录刷新失败或主程序升级都不会改变已有安装。1.3.1 会忽略旧版包含全量源码的目录缓存，重新获取元数据列表，不把旧缓存中的脚本自动安装。

这延续原版 GUI 的[空中心先加载目录、用户选择添加](https://github.com/GUI-for-Cores/GUI.for.SingBox/blob/f0de129e3c7ee0278eff12f13bbfa435fcc8e57d/frontend/src/views/PluginsView/components/PluginHub.vue#L58-L92)流程：[目录更新只读取 JSON](https://github.com/GUI-for-Cores/GUI.for.SingBox/blob/f0de129e3c7ee0278eff12f13bbfa435fcc8e57d/frontend/src/stores/plugins.ts#L662-L687)，选择安装时才[获取源码](https://github.com/GUI-for-Cores/GUI.for.SingBox/blob/f0de129e3c7ee0278eff12f13bbfa435fcc8e57d/frontend/src/stores/plugins.ts#L548-L607)。WebUI 另加摘要与语法校验，成功后才写入安装。

历史上 1.3.0 及更早主程序曾随附插件目录，该发行与缓存合并方案从 1.3.1 起取消；发布主程序不再同步任何插件源码快照。

## 路由器使用边界

GL-MT3600BE 与其他设备均需按实际系统、架构、TUN 设备、权限及 fw3/fw4 环境验证；生成成功不等于固件具备对应能力。已有 TUN 应直接调整原配置，插件不会静默替换；请核对实际 LAN 接口并设置管理地址/NAS 排除网段。

TUN 内 DNS 劫持只覆盖进入 TUN 的流量，**不会自动接管客户端发往路由器 LAN IP / dnsmasq:53 的请求**。插件不执行 shell、不直接改写系统路由、防火墙或 dnsmasq；核心启动后会按配置尝试启用对应网络功能。

诊断的 `configured`、`direct`、`core` 分别使用后台请求策略、路由器直连或当前核心代理。核心代理不可用会报告错误，不静默直连。测量针对路由器后端出口，不保证每台 LAN 设备同路由。GeoIP 是第三方近似信息；媒体响应截断/网络失败为未知，未测试账号、播放和 Disney 设备注册；下载结果包含建连开销，不是 Ookla 全量测速或线路带宽保证。

本轮不自动安装 daemon，不提供桌面托盘/窗口、系统代理、Windows ICS、UWP 豁免或客户端字体安装。Sub-Store、节点转换/配置器、聚合订阅、备份同步、FRP、Xray 前置和长期流量统计等真实需求的后续条件列于 [完整审计](docs/upstream-review.md)，不以同名空壳宣称完成。

## 开发接口

| 元数据/触发器 | 函数 | 数据 |
| --- | --- | --- |
| `on::subscribe` | `onSubscribe(proxies, subscription)` | 节点数组和订阅元数据，返回变换结果 |
| `on::generate` | `onGenerate(config)` | 生成配置，返回变换结果 |
| `on::manual`，订阅模式 | `onRun(proxies, subscription)` | 选定缓存订阅，返回变换结果 |
| `on::manual`，`manual_target: "diagnostic"` | `onRun()` | 返回 JSON 报告，不持久化配置或订阅 |

普通转换可返回新数据，或原地修改参数并不返回；诊断返回报告。全局 `configuration` 合并默认值与覆盖；`console.log` 等及 `Plugins.Log` 提供有限日志。每次调用独立 Goja 环境，无模块加载、文件、shell、Wails、前端 Store 或任意 UI 组件。

仅显式手动诊断可用受限的 `Plugins.fetch`、`Plugins.measureDownload`，不是浏览器 `fetch`，订阅/配置钩子不能联网。诊断限时 20 秒、每请求 5 秒、最多 8 次请求；文本响应每次 64 KiB/累计 256 KiB，下载另限 8 MiB。凭据留在后端，不向脚本传主程序 GitHub token 或下载镜像。完整契约见 [主程序插件文档](https://github.com/Ghostdehole/WEBUI.for.SingBox/blob/main/docs/plugins.md)。

`configuration_schema` 支持 `Switch`、`Radio`、`Input`、`TextArea`，只描述数据；`conflicts` 声明不能同时启用的 ID。时间、栈与序列化限制不等于强内存隔离，管理员仍需审阅所安装源码。

## 维护与验证

```text
index.json                  元数据、参数、相对路径、SHA256
plugins/*.js                独立后端脚本
sources/naming/             命名源码和固定地区表
scripts/build-organizer.mjs 离线生成订阅整理脚本
tests/                     Node 行为测试与真实 Goja 夹具
upstream/audit.json         100 个官方入口的摘要和最终决定
docs/upstream-review.md     中文逐项适配说明
```

修改命名源码后，在插件仓库运行：

```sh
node scripts/build-organizer.mjs
node scripts/build-policies.mjs
node scripts/build-organizer.mjs --check
node scripts/build-policies.mjs --check
node --test tests/*.test.mjs
```

在配套主程序源码目录运行，路径按实际 checkout 调整：

```sh
go run ./cmd/plugin-check -write-index ../WEBUI.for.SingBox-Plugins
go run ./cmd/plugin-check ../WEBUI.for.SingBox-Plugins
go run ../WEBUI.for.SingBox-Plugins/tests/goja/main.go ../WEBUI.for.SingBox-Plugins
```

校验器检查路径、容量、摘要、元数据与语法；行为/真实 Goja 测试验证转换、引用、冲突和适用转换的幂等性。设置 `SING_BOX_114_PATH` 可让夹具调用真实核心检查代表配置；运行夹具需带上 `index.json`、`plugins/` 和 `tests/fixtures.json`。Linux 专属 TUN 配置需要在 Linux 核心环境执行，本轮交由隔离 CI/模拟环境验证，不能把 Windows 上跳过该项视为 Linux 已通过。按用户要求不连接真实 GL 路由器；这些检查不能替代实体设备网络验证。

保持 LF 换行，将源码和新清单只提交到本插件仓库；源码变更应递增插件版本。主仓库不复制清单或脚本，主程序发布不打包插件。用户通过插件中心下载和更新，新增宿主能力仍需升级主程序。SHA256 只校验清单与脚本一致性，来源信任仍依赖仓库权限与 HTTPS。

本仓库按 GPL-3.0-only 分发；来源和适配说明见 [NOTICE](NOTICE.md)，许可正文见 [LICENSE](LICENSE)。
