# 官方插件路由器适配审计

本轮逐项审阅了 **100 个官方插件入口**，发布 **16 个后端插件**。覆盖全部源文件是审计范围，不表示完整复刻这 100 个插件。多个桌面插件的同类需求合并为一个路由器实现；部分仅提供明确限定的替代能力。

来源固定为 [Plugin-Hub `205ecacb`](https://github.com/GUI-for-Cores/Plugin-Hub/tree/205ecacb0742a185947252cb91e5b11541c32a94) 与 [GUI.for.SingBox `f0de129`](https://github.com/GUI-for-Cores/GUI.for.SingBox/tree/f0de129e3c7ee0278eff12f13bbfa435fcc8e57d)。上游 `package.json` 声明作者 GUI.for.Cores、许可证 GPL-3.0，完整归属见 [NOTICE](../NOTICE.md)。逐文件 SHA256、依赖、冲突、审阅意见及最终结论见 [机器可读审计](../upstream/audit.json)。

范围为 Generic 81、GFS 13、GFC 5、Extra 1。按完整路径核对固定提交的 Git tree 和原始 blob 摘要；跨目录同名 ID 分别记录。`plugins/Resources/plugin-ui-dev-helper/hotreload.js` 是支持资源，不是第 101 个插件入口，另行记录其摘要。

## 使用与适用边界

- 本轮目录要求 **WEBUI.for.SingBox 1.3.0 或更新版本**；配置生成以 sing-box 1.14.x 为基线。先升级主程序，再更新插件。
- 八个配置插件默认不改变配置：DNS、配置覆盖、TUN、URLTest 的 `Enabled` 关闭，链路/规则集/独立监听为空列表。填写实际 tag、接口和网络后预览配置，再按需手动重启核心。
- 三个命名插件互斥启用。旧用户更新前先禁用多余项；完整命名表含 142 地区、907 关键词，保留节点 ID 与引用，不查询 IP。
- 诊断仅测路由器后端所选出口，不改当前 selector，不保证每台 LAN 客户端经过同一路由。短下载样本不是线路极限测速，网页可达不是媒体解锁证明。
- URLTest 由核心探测选择，不等价 EWMA 智能评分、连接日志错误阈值、低速切换或按序故障转移。
- 透明代理插件生成显式 TUN 配置，不执行 shell 或改写系统防火墙/dnsmasq。核心启动后是否能应用配置取决于固件、权限和网络；发往路由器 LAN IP:53 的 DNS 不会因 TUN 内劫持自动接管。
- 不自动安装/启动 Sub-Store、Xray、AdGuardHome 等 daemon，不提供桌面托盘、系统代理或 UWP 权限修改。GL-MT3600BE 与其他设备均需按实际架构、内核、fw3/fw4 和服务配置验证。

## 尚需专门工程的路由需求

节点多格式转换/配置器、Sub-Store、聚合订阅、Gists/WebDAV 备份、Xray 前置、WARP、PAC、FRP、长期流量统计和完整后台故障转移均保留为真实需求。本轮不把“当前脚本 API 没有该能力”当作无价值；它们需要有边界的持久存储、作业/服务生命周期、认证和取消、资源配额或事务，而不是直接运行官方桌面 JS。下表逐项列出当前决定。

## 逐文件最终决定

“已适配”表示表中限定功能已实现，不包含原桌面 UI；“部分能力替代”明确不是原算法或协议的等价实现；“待设计/服务”尚未实现；主程序替代项没有对应独立插件 ID。完整的原始静态审阅保留在 JSON 的 `review`，最终状态以 `disposition`、`target_ids`、`conclusion` 为准。

### Generic（81 项）

| 官方源文件 | 决定 | 本轮目标 | 能力边界 / 未移植理由 |
| --- | --- | --- | --- |
| [plugin-adguardhome.js](https://github.com/GUI-for-Cores/Plugin-Hub/blob/205ecacb0742a185947252cb91e5b11541c32a94/plugins/Generic/plugin-adguardhome.js) | 已适配部分能力 | [plugin-adguardhome](../plugins/plugin-adguardhome.js) | 仅将已运行的 AdGuardHome 对接到 sing-box DNS；不下载、安装、升级、备份或启动 daemon。 |
| [plugin-aliyunpan-signin.js](https://github.com/GUI-for-Cores/Plugin-Hub/blob/205ecacb0742a185947252cb91e5b11541c32a94/plugins/Generic/plugin-aliyunpan-signin.js) | 待受管后台服务 | — | 签到属于独立账号任务；需要受保护凭据、受限 POST 与调度事务，本轮不发布。 |
| [plugin-are-you-chinese.js](https://github.com/GUI-for-Cores/Plugin-Hub/blob/205ecacb0742a185947252cb91e5b11541c32a94/plugins/Generic/plugin-are-you-chinese.js) | 部分能力替代 | [plugin-network-info](../plugins/plugin-network-info.js) | 以路由器出口 trace/连通报告替代网络自查需求；未复制 Claude 专项判断及浏览器语言、字体、时区指纹。 |
| [plugin-auto-failover.js](https://github.com/GUI-for-Cores/Plugin-Hub/blob/205ecacb0742a185947252cb91e5b11541c32a94/plugins/Generic/plugin-auto-failover.js) | 部分能力替代 | [plugin-router-urltest](../plugins/plugin-router-urltest.js) | 提供核心 URLTest 持续探测选择；未实现日志失败计数、阈值窗口、冷却、按序故障转移和历史通知。 |
| [plugin-bandwagon-vps.js](https://github.com/GUI-for-Cores/Plugin-Hub/blob/205ecacb0742a185947252cb91e5b11541c32a94/plugins/Generic/plugin-bandwagon-vps.js) | 本轮路由范围外 | — | VPS 开关机、重装和快照应留专门管理控制面；本轮不向插件开放此类远端账号写操作。 |
| [plugin-batch-download-speed.js](https://github.com/GUI-for-Cores/Plugin-Hub/blob/205ecacb0742a185947252cb91e5b11541c32a94/plugins/Generic/plugin-batch-download-speed.js) | 部分能力替代 | [plugin-speedtest](../plugins/plugin-speedtest.js) | 仅提供当前出口 64 KiB–8 MiB 有界 HTTP 样本，不切换生产节点、不批量排名、不保留桌面历史任务。 |
| [plugin-beautiful-node-name.js](https://github.com/GUI-for-Cores/Plugin-Hub/blob/205ecacb0742a185947252cb91e5b11541c32a94/plugins/Generic/plugin-beautiful-node-name.js) | 已适配 | [plugin-beautiful-node-name](../plugins/plugin-beautiful-node-name.js) | 移植完整地区/城市识别并保留旧参数、节点身份、内部引用和幂等；手动操作已有缓存，不重跑官方 UI/store 更新或二次过滤。 |
| [plugin-check-certificate.js](https://github.com/GUI-for-Cores/Plugin-Hub/blob/205ecacb0742a185947252cb91e5b11541c32a94/plugins/Generic/plugin-check-certificate.js) | 桌面/开发平台不适用 | — | Sysinternals/Windows 证书库扫描不适用于 OpenWrt；本轮没有整机证书信任审计功能。 |
| [plugin-clash-api-dashboard.js](https://github.com/GUI-for-Cores/Plugin-Hub/blob/205ecacb0742a185947252cb91e5b11541c32a94/plugins/Generic/plugin-clash-api-dashboard.js) | 主程序承担部分用途 | — | 由主程序认证原生仪表盘承担监控/选择器入口；不复刻第三方面板 UI，不打开 Clash API 或向外传 secret。 |
| [plugin-cliproxyapi.js](https://github.com/GUI-for-Cores/Plugin-Hub/blob/205ecacb0742a185947252cb91e5b11541c32a94/plugins/Generic/plugin-cliproxyapi.js) | 待受管后台服务 | — | AI 兼容服务仍有使用场景，但安装、账号和 daemon 生命周期需独立服务管理，本轮不托管。 |
| [plugin-codex-usage-viewer.js](https://github.com/GUI-for-Cores/Plugin-Hub/blob/205ecacb0742a185947252cb91e5b11541c32a94/plugins/Generic/plugin-codex-usage-viewer.js) | 本轮路由范围外 | — | 桌面账号用量/托盘功能不属于路由插件；不读取宿主或客户端凭据。 |
| [plugin-configuration-example.js](https://github.com/GUI-for-Cores/Plugin-Hub/blob/205ecacb0742a185947252cb91e5b11541c32a94/plugins/Generic/plugin-configuration-example.js) | 仅文档/开发参考 | — | 配置 schema/安全示例在文档和测试中说明，不作为实际路由插件上架。 |
| [plugin-custom-theme.js](https://github.com/GUI-for-Cores/Plugin-Hub/blob/205ecacb0742a185947252cb91e5b11541c32a94/plugins/Generic/plugin-custom-theme.js) | 主程序承担部分用途 | — | 基础主题、颜色、字体沿用浏览器设置；未移植任意 CSS、背景资源管理或桌面托盘图标。 |
| [plugin-deepseek-chan.js](https://github.com/GUI-for-Cores/Plugin-Hub/blob/205ecacb0742a185947252cb91e5b11541c32a94/plugins/Generic/plugin-deepseek-chan.js) | 本轮路由范围外 | — | Live2D 装饰不是后台路由能力；未加载远端模型和脚本。 |
| [plugin-download-speed-guard.js](https://github.com/GUI-for-Cores/Plugin-Hub/blob/205ecacb0742a185947252cb91e5b11541c32a94/plugins/Generic/plugin-download-speed-guard.js) | 待受管后台服务 | — | 吞吐低速不能直接判断网关故障；需独立后台负载/窗口/冷却和选择器协调，URLTest 不冒充此逻辑。 |
| [plugin-duplicate-proxies-removal.js](https://github.com/GUI-for-Cores/Plugin-Hub/blob/205ecacb0742a185947252cb91e5b11541c32a94/plugins/Generic/plugin-duplicate-proxies-removal.js) | 已适配 | [plugin-duplicate-proxies-removal](../plugins/plugin-duplicate-proxies-removal.js) | 使用完整配置指纹而非仅 server:port 去重，保留不同凭据/协议/TLS并修复引用；去除上游隐式附加索引。 |
| [plugin-emudhra-ca-check.js](https://github.com/GUI-for-Cores/Plugin-Hub/blob/205ecacb0742a185947252cb91e5b11541c32a94/plugins/Generic/plugin-emudhra-ca-check.js) | 待专门能力设计 | — | 固定证书链诊断有价值，但本轮未提供专门测试清单和 TLS 信任报告；通用网络错误不等于证书安全结论。 |
| [plugin-fast-delay-test.js](https://github.com/GUI-for-Cores/Plugin-Hub/blob/205ecacb0742a185947252cb91e5b11541c32a94/plugins/Generic/plugin-fast-delay-test.js) | 待受管后台服务 | — | 独立订阅测速核心、排序与删除仍需有界作业/结果预览/取消清理；已有运行核心测速并不覆盖全部功能。 |
| [plugin-file-server.js](https://github.com/GUI-for-Cores/Plugin-Hub/blob/205ecacb0742a185947252cb91e5b11541c32a94/plugins/Generic/plugin-file-server.js) | 待受管后台服务 | — | LAN 文件服务需求保留给独立 NAS/受管服务；不在插件中开启额外无认证文件服务器。 |
| [plugin-file-transfer-assistant.js](https://github.com/GUI-for-Cores/Plugin-Hub/blob/205ecacb0742a185947252cb91e5b11541c32a94/plugins/Generic/plugin-file-transfer-assistant.js) | 待受管后台服务 | — | 文件互传需认证、目录边界、磁盘配额与持久服务，不复刻桌面文件选择器或无认证上传端口。 |
| [plugin-frp-client.js](https://github.com/GUI-for-Cores/Plugin-Hub/blob/205ecacb0742a185947252cb91e5b11541c32a94/plugins/Generic/plugin-frp-client.js) | 待受管后台服务 | — | 内网穿透是有效路由用途；应对接 frpc/procd 和受限配置动作，本轮不下载或启动 FRP。 |
| [plugin-generate-warp-config.js](https://github.com/GUI-for-Cores/Plugin-Hub/blob/205ecacb0742a185947252cb91e5b11541c32a94/plugins/Generic/plugin-generate-warp-config.js) | 待专门能力设计 | — | WARP 需密钥生成、显式注册 POST、秘密存储和 endpoint 验证；未提供只改节点而无可用服务的替代品。 |
| [plugin-geoip-search.js](https://github.com/GUI-for-Cores/Plugin-Hub/blob/205ecacb0742a185947252cb91e5b11541c32a94/plugins/Generic/plugin-geoip-search.js) | 已适配部分能力 | [plugin-geoip-search](../plugins/plugin-geoip-search.js) | 用受限 HTTPS 查询显式 IP 或出口的地区/ASN/运营商；第三方信息非精确地理位置，也非欺诈风险或解锁结论。 |
| [plugin-gitea.js](https://github.com/GUI-for-Cores/Plugin-Hub/blob/205ecacb0742a185947252cb91e5b11541c32a94/plugins/Generic/plugin-gitea.js) | 待受管后台服务 | — | Git 仓库服务安装/数据库/账号生命周期由专用服务负责，本轮不在路由 WebUI 托管。 |
| [plugin-github-commit-history.js](https://github.com/GUI-for-Cores/Plugin-Hub/blob/205ecacb0742a185947252cb91e5b11541c32a94/plugins/Generic/plugin-github-commit-history.js) | 本轮路由范围外 | — | 任意仓库提交浏览不是本轮路由功能；主程序版本信息不等价完整提交浏览器。 |
| [plugin-github-workflows.js](https://github.com/GUI-for-Cores/Plugin-Hub/blob/205ecacb0742a185947252cb91e5b11541c32a94/plugins/Generic/plugin-github-workflows.js) | 本轮路由范围外 | — | 工作流、artifact、release/tag 写入删除留 GitHub 控制面；不将仓库管理 token 交给通用脚本。 |
| [plugin-global-click-ripple-effect.js](https://github.com/GUI-for-Cores/Plugin-Hub/blob/205ecacb0742a185947252cb91e5b11541c32a94/plugins/Generic/plugin-global-click-ripple-effect.js) | 本轮路由范围外 | — | 浏览器装饰不作为后台路由插件发布，未实现全局 DOM 注入。 |
| [plugin-gui-agent.js](https://github.com/GUI-for-Cores/Plugin-Hub/blob/205ecacb0742a185947252cb91e5b11541c32a94/plugins/Generic/plugin-gui-agent.js) | 待专门能力设计 | — | 助手如需实现应走独立受控工具和审计设计；本轮不开放任意 root shell、文件或全资源管理。 |
| [plugin-gui-restful-api-v1.js](https://github.com/GUI-for-Cores/Plugin-Hub/blob/205ecacb0742a185947252cb91e5b11541c32a94/plugins/Generic/plugin-gui-restful-api-v1.js) | 主程序承担部分用途 | — | 复用主程序已认证 HTTP/RPC；不另建监听端口，也不宣称兼容官方全部 REST/桌面窗口端点。 |
| [plugin-hosts-management.js](https://github.com/GUI-for-Cores/Plugin-Hub/blob/205ecacb0742a185947252cb91e5b11541c32a94/plugins/Generic/plugin-hosts-management.js) | 已适配部分能力 | [plugin-hosts-management](../plugins/plugin-hosts-management.js) | 转为 sing-box DNS hosts 映射和作用域规则；不覆盖 /etc/hosts，不管理三份系统 hosts 预设。 |
| [plugin-hotkey-api-bridge.js](https://github.com/GUI-for-Cores/Plugin-Hub/blob/205ecacb0742a185947252cb91e5b11541c32a94/plugins/Generic/plugin-hotkey-api-bridge.js) | 桌面/开发平台不适用 | — | Windows 全局热键属于访问者电脑，本轮不从路由器注册或监听客户端系统热键。 |
| [plugin-index-the-proxy-name.js](https://github.com/GUI-for-Cores/Plugin-Hub/blob/205ecacb0742a185947252cb91e5b11541c32a94/plugins/Generic/plugin-index-the-proxy-name.js) | 已适配 | [plugin-index-the-proxy-name](../plugins/plugin-index-the-proxy-name.js) | 保持索引功能，增加稳定重复执行、节点 ID 保留和内部引用重映射；与另两命名插件互斥启用。 |
| [plugin-install-font.js](https://github.com/GUI-for-Cores/Plugin-Hub/blob/205ecacb0742a185947252cb91e5b11541c32a94/plugins/Generic/plugin-install-font.js) | 桌面/开发平台不适用 | — | 不能在路由器为访问者 Windows 安装字体/注册表；继续使用浏览器现有字体偏好。 |
| [plugin-ip-geolocation.js](https://github.com/GUI-for-Cores/Plugin-Hub/blob/205ecacb0742a185947252cb91e5b11541c32a94/plugins/Generic/plugin-ip-geolocation.js) | 已合并 | [plugin-network-info](../plugins/plugin-network-info.js) | 合并到路由器出口诊断；显示实际请求出口报告，不提供桌面状态栏/托盘。 |
| [plugin-ipc-logs.js](https://github.com/GUI-for-Cores/Plugin-Hub/blob/205ecacb0742a185947252cb91e5b11541c32a94/plugins/Generic/plugin-ipc-logs.js) | 主程序承担部分用途 | — | 使用主程序日志与诊断，不注入 Wails IPC hook；未复刻桌面 IPC 参数导出工具。 |
| [plugin-live2d-widget.js](https://github.com/GUI-for-Cores/Plugin-Hub/blob/205ecacb0742a185947252cb91e5b11541c32a94/plugins/Generic/plugin-live2d-widget.js) | 本轮路由范围外 | — | 浏览器看板娘与模型主题不属于路由服务，本轮不移植。 |
| [plugin-media-unlock-checker.js](https://github.com/GUI-for-Cores/Plugin-Hub/blob/205ecacb0742a185947252cb91e5b11541c32a94/plugins/Generic/plugin-media-unlock-checker.js) | 已适配部分能力 | [plugin-media-unlock-checker](../plugins/plugin-media-unlock-checker.js) | 仅 Netflix、YouTube Premium、Spotify 的只读页面/服务观察；截断和网络错误为未知，未实现 Disney 注册/所有平台或播放验证。 |
| [plugin-meilisearch.js](https://github.com/GUI-for-Cores/Plugin-Hub/blob/205ecacb0742a185947252cb91e5b11541c32a94/plugins/Generic/plugin-meilisearch.js) | 待受管后台服务 | — | 搜索引擎是独立高资源服务，本轮不安装、启动或管理其数据库。 |
| [plugin-metacubexd-dashboard.js](https://github.com/GUI-for-Cores/Plugin-Hub/blob/205ecacb0742a185947252cb91e5b11541c32a94/plugins/Generic/plugin-metacubexd-dashboard.js) | 主程序承担部分用途 | — | 使用本地认证原生仪表盘；未移植 MetaCubeXD 或外传 Clash controller/secret。 |
| [plugin-mitm-core.js](https://github.com/GUI-for-Cores/Plugin-Hub/blob/205ecacb0742a185947252cb91e5b11541c32a94/plugins/Generic/plugin-mitm-core.js) | 待受管后台服务 | — | HTTPS 拦截、CA 信任和前置服务需单独受管部署及明确客户端配置，本轮不自动接管 LAN。 |
| [plugin-mmdb-example.js](https://github.com/GUI-for-Cores/Plugin-Hub/blob/205ecacb0742a185947252cb91e5b11541c32a94/plugins/Generic/plugin-mmdb-example.js) | 部分能力替代 | [plugin-geoip-search](../plugins/plugin-geoip-search.js) | 仅提供在线地区查询替代基础查 IP 需求；没有离线 MMDB 数据库、文件句柄或查询 API。 |
| [plugin-modify-proxy-name.js](https://github.com/GUI-for-Cores/Plugin-Hub/blob/205ecacb0742a185947252cb91e5b11541c32a94/plugins/Generic/plugin-modify-proxy-name.js) | 已适配 | [plugin-modify-proxy-name](../plugins/plugin-modify-proxy-name.js) | 扩充完整地区和兼容别名，保留 flag/移除关键词/索引参数及引用修复；边界匹配避免普通单词误命中。 |
| [plugin-music-player.js](https://github.com/GUI-for-Cores/Plugin-Hub/blob/205ecacb0742a185947252cb91e5b11541c32a94/plugins/Generic/plugin-music-player.js) | 本轮路由范围外 | — | 音频播放/频谱属于客户端媒体功能；本轮不授予访问路由器任意音频目录的能力。 |
| [plugin-network-info.js](https://github.com/GUI-for-Cores/Plugin-Hub/blob/205ecacb0742a185947252cb91e5b11541c32a94/plugins/Generic/plugin-network-info.js) | 已适配部分能力 | [plugin-network-info](../plugins/plugin-network-info.js) | 合并出口 trace 和最多六个站点 HEAD 连通诊断；不复制全部第三方 IP 提供商或桌面弹窗实现。 |
| [plugin-network-sharing.js](https://github.com/GUI-for-Cores/Plugin-Hub/blob/205ecacb0742a185947252cb91e5b11541c32a94/plugins/Generic/plugin-network-sharing.js) | 部分能力替代 | [plugin-router-transparent-proxy](../plugins/plugin-router-transparent-proxy.js) | 保留 LAN 透明代理需求，以显式 TUN 配置实现部分用途；没有 Windows ICS、自动网卡共享、系统防火墙/DHCP改写。 |
| [plugin-node-configurator.js](https://github.com/GUI-for-Cores/Plugin-Hub/blob/205ecacb0742a185947252cb91e5b11541c32a94/plugins/Generic/plugin-node-configurator.js) | 待专门能力设计 | — | 协议表单与导出有价值；需要固定版本转换库、当前核心字段验证及持久化事务，本轮未移植。 |
| [plugin-node-convert.js](https://github.com/GUI-for-Cores/Plugin-Hub/blob/205ecacb0742a185947252cb91e5b11541c32a94/plugins/Generic/plugin-node-convert.js) | 待专门能力设计 | — | 多格式完整转换需在订阅验证前接入固定版本转换器，保留未知/目标字段；本轮不加载远程 ESM，也不声称所有格式已兼容。 |
| [plugin-open-yacd-meta-dashboard.js](https://github.com/GUI-for-Cores/Plugin-Hub/blob/205ecacb0742a185947252cb91e5b11541c32a94/plugins/Generic/plugin-open-yacd-meta-dashboard.js) | 主程序承担部分用途 | — | 使用主程序原生仪表盘；不向第三方 URL 传管理 secret，不启用额外 Clash 端口。 |
| [plugin-openlist.js](https://github.com/GUI-for-Cores/Plugin-Hub/blob/205ecacb0742a185947252cb91e5b11541c32a94/plugins/Generic/plugin-openlist.js) | 待受管后台服务 | — | NAS 用途可保留，但需平台/ABI匹配、受管进程、持久存储和认证，本轮不安装 OpenList。 |
| [plugin-overview-scroll-reverse.js](https://github.com/GUI-for-Cores/Plugin-Hub/blob/205ecacb0742a185947252cb91e5b11541c32a94/plugins/Generic/plugin-overview-scroll-reverse.js) | 浏览器功能未移植 | — | 可作为本地浏览器交互偏好，原 DOM/按钮结构需适配；本轮未复制滚轮逻辑。 |
| [plugin-pac-server.js](https://github.com/GUI-for-Cores/Plugin-Hub/blob/205ecacb0742a185947252cb91e5b11541c32a94/plugins/Generic/plugin-pac-server.js) | 待受管后台服务 | — | 路由器 PAC 服务有实用性，需后台持久化、正确 LAN 地址和访问范围；本轮没有独立 PAC 服务。 |
| [plugin-quick-start-guide.js](https://github.com/GUI-for-Cores/Plugin-Hub/blob/205ecacb0742a185947252cb91e5b11541c32a94/plugins/Generic/plugin-quick-start-guide.js) | 待专门能力设计 | — | 路由器完整引导需类型化模板和环境诊断；现有配置插件不等价自动创建订阅/配置的向导。 |
| [plugin-random-wallpaper.js](https://github.com/GUI-for-Cores/Plugin-Hub/blob/205ecacb0742a185947252cb91e5b11541c32a94/plugins/Generic/plugin-random-wallpaper.js) | 桌面/开发平台不适用 | — | 原功能改变系统桌面壁纸；无桌面路由器不能修改访问者的桌面，本轮也不提供壁纸下载历史。 |
| [plugin-rolling-release.js](https://github.com/GUI-for-Cores/Plugin-Hub/blob/205ecacb0742a185947252cb91e5b11541c32a94/plugins/Generic/plugin-rolling-release.js) | 主程序承担部分用途 | — | 更新通过本 fork 主程序更新机制处理；不下载官方 GUI 前端覆盖 fork，也不复刻独立前端滚动通道。 |
| [plugin-rss-reader.js](https://github.com/GUI-for-Cores/Plugin-Hub/blob/205ecacb0742a185947252cb91e5b11541c32a94/plugins/Generic/plugin-rss-reader.js) | 本轮路由范围外 | — | RSS 阅读是可选网页功能而非本轮路由能力；未加载远程解析脚本或文章 iframe。 |
| [plugin-scamalytics-ip-fraud-risk.js](https://github.com/GUI-for-Cores/Plugin-Hub/blob/205ecacb0742a185947252cb91e5b11541c32a94/plugins/Generic/plugin-scamalytics-ip-fraud-risk.js) | 待专门能力设计 | — | 商业风险查询需用户凭据、受限提供商请求和结果语义；现有 GeoIP 不替代风险评分。 |
| [plugin-screen-recorder.js](https://github.com/GUI-for-Cores/Plugin-Hub/blob/205ecacb0742a185947252cb91e5b11541c32a94/plugins/Generic/plugin-screen-recorder.js) | 本轮路由范围外 | — | 录制的是浏览器所在设备而非路由器；本轮不提供屏幕授权或视频写盘功能。 |
| [plugin-skin-manager.js](https://github.com/GUI-for-Cores/Plugin-Hub/blob/205ecacb0742a185947252cb91e5b11541c32a94/plugins/Generic/plugin-skin-manager.js) | 主程序承担部分用途 | — | 基础个性化沿用浏览器主题设置；未迁移远程皮肤目录、任意 CSS、装饰事件和全局资源缓存。 |
| [plugin-smart-proxy-switcher.js](https://github.com/GUI-for-Cores/Plugin-Hub/blob/205ecacb0742a185947252cb91e5b11541c32a94/plugins/Generic/plugin-smart-proxy-switcher.js) | 部分能力替代 | [plugin-router-urltest](../plugins/plugin-router-urltest.js) | 将基础自动选择需求交给核心 URLTest；不复刻 EWMA、熔断惩罚、桌面定时器、全部 provider 策略和历史。 |
| [plugin-speedtest-cli.js](https://github.com/GUI-for-Cores/Plugin-Hub/blob/205ecacb0742a185947252cb91e5b11541c32a94/plugins/Generic/plugin-speedtest-cli.js) | 部分能力替代 | [plugin-speedtest](../plugins/plugin-speedtest.js) | 用当前出口限量 HTTP 样本替代基础测速需求；没有 Ookla CLI、服务器选择、上传测速或完整测速历史。 |
| [plugin-speedtest.js](https://github.com/GUI-for-Cores/Plugin-Hub/blob/205ecacb0742a185947252cb91e5b11541c32a94/plugins/Generic/plugin-speedtest.js) | 已适配部分能力 | [plugin-speedtest](../plugins/plugin-speedtest.js) | 改为流式按实际字节统计的限量下载样本，不写闪存、不自动切换节点，不宣称线路极限吞吐。 |
| [plugin-sub-store-script-support.js](https://github.com/GUI-for-Cores/Plugin-Hub/blob/205ecacb0742a185947252cb91e5b11541c32a94/plugins/Generic/plugin-sub-store-script-support.js) | 待受管后台服务 | — | 脚本测试侧车需要受管第二核心、端口和资源限额；本轮不下载 Mihomo 或提供 /start /stop 服务。 |
| [plugin-sub-store-v2.js](https://github.com/GUI-for-Cores/Plugin-Hub/blob/205ecacb0742a185947252cb91e5b11541c32a94/plugins/Generic/plugin-sub-store-v2.js) | 待受管后台服务 | — | Sub-Store 是有效常驻路由服务，需 Node/ABI/内存匹配、认证同源入口及 procd 生命周期，本轮不托管。 |
| [plugin-sub-store-v3.js](https://github.com/GUI-for-Cores/Plugin-Hub/blob/205ecacb0742a185947252cb91e5b11541c32a94/plugins/Generic/plugin-sub-store-v3.js) | 待受管后台服务 | — | 远程 AsyncFunction bundle、HTTP handler、存储和桌面 watch 需完整后台化；不因名称纯净版而直接执行下载脚本。 |
| [plugin-subscribe-collection.js](https://github.com/GUI-for-Cores/Plugin-Hub/blob/205ecacb0742a185947252cb91e5b11541c32a94/plugins/Generic/plugin-subscribe-collection.js) | 待专门能力设计 | — | 虚拟聚合订阅需 DAG 循环检查、事务缓存、完整节点指纹及引用修复；本轮未提供聚合订阅。 |
| [plugin-subscribe-in-one-click.js](https://github.com/GUI-for-Cores/Plugin-Hub/blob/205ecacb0742a185947252cb91e5b11541c32a94/plugins/Generic/plugin-subscribe-in-one-click.js) | 待专门能力设计 | — | 快捷导入需要 WebUI 认证导入链接/预览；本轮不注册 Windows 协议处理器，也不称普通粘贴导入为等价插件。 |
| [plugin-sync-configuration-gists.js](https://github.com/GUI-for-Cores/Plugin-Hub/blob/205ecacb0742a185947252cb91e5b11541c32a94/plugins/Generic/plugin-sync-configuration-gists.js) | 待专门能力设计 | — | 离站备份仍有价值，但需新存储 schema、认证加密、允许名单与原子恢复；本轮无 Gists 备份上传。 |
| [plugin-sync-configuration-webdav.js](https://github.com/GUI-for-Cores/Plugin-Hub/blob/205ecacb0742a185947252cb91e5b11541c32a94/plugins/Generic/plugin-sync-configuration-webdav.js) | 待专门能力设计 | — | WebDAV 备份需统一版本化备份事务和凭据保护；本轮无同步、恢复或远端删除。 |
| [plugin-sync-configuration.js](https://github.com/GUI-for-Cores/Plugin-Hub/blob/205ecacb0742a185947252cb91e5b11541c32a94/plugins/Generic/plugin-sync-configuration.js) | 待专门能力设计 | — | gui-sync 的桌面 YAML/部署语义不适用于当前存储；需新格式及原子恢复，不把文件逐项覆盖当作可用备份。 |
| [plugin-system-proxy-guard.js](https://github.com/GUI-for-Cores/Plugin-Hub/blob/205ecacb0742a185947252cb91e5b11541c32a94/plugins/Generic/plugin-system-proxy-guard.js) | 桌面/开发平台不适用 | — | 桌面 OS 全局代理守卫不等于路由器 TUN/防火墙健康守护；本轮不定时重设系统代理或恢复透明策略。 |
| [plugin-systemproxy-external.js](https://github.com/GUI-for-Cores/Plugin-Hub/blob/205ecacb0742a185947252cb91e5b11541c32a94/plugins/Generic/plugin-systemproxy-external.js) | 桌面/开发平台不适用 | — | macOS networksetup/Thunderbolt Ethernet 代理无法对应 OpenWrt，未修改 LAN 客户端系统设置。 |
| [plugin-terminal-proxy.js](https://github.com/GUI-for-Cores/Plugin-Hub/blob/205ecacb0742a185947252cb91e5b11541c32a94/plugins/Generic/plugin-terminal-proxy.js) | 待专门能力设计 | — | 安全命令生成对 SSH/客户端有用，但需要区分主机、实际入站、IPv6和引号；本轮不设置客户端环境变量。 |
| [plugin-traffic-monitor.js](https://github.com/GUI-for-Cores/Plugin-Hub/blob/205ecacb0742a185947252cb91e5b11541c32a94/plugins/Generic/plugin-traffic-monitor.js) | 主程序承担部分用途 | — | 基础状态可看主程序概览/核心 RSS；没有 Windows TrafficMonitor.exe、任务栏或其全部网卡监控能力。 |
| [plugin-traffic-statistics-vibe.js](https://github.com/GUI-for-Cores/Plugin-Hub/blob/205ecacb0742a185947252cb91e5b11541c32a94/plugins/Generic/plugin-traffic-statistics-vibe.js) | 待受管后台服务 | — | 长期客户端/节点/月度统计需单一后台采集器、留存配额和准确归属；概览瞬时流量不等价本插件。 |
| [plugin-traffic-statistics.js](https://github.com/GUI-for-Cores/Plugin-Hub/blob/205ecacb0742a185947252cb91e5b11541c32a94/plugins/Generic/plugin-traffic-statistics.js) | 待受管后台服务 | — | 持久流量统计与 vibe 版应统一后台实现；本轮不启动额外 HTTP 统计端口或浏览器采集器。 |
| [plugin-tun-assistant.js](https://github.com/GUI-for-Cores/Plugin-Hub/blob/205ecacb0742a185947252cb91e5b11541c32a94/plugins/Generic/plugin-tun-assistant.js) | 部分能力替代 | [plugin-router-transparent-proxy](../plugins/plugin-router-transparent-proxy.js) | 提供显式 TUN/可选 DNS 劫持配置和兼容说明；没有自动提权、setcap/setuid操作，也不保证固件环境可用。 |
| [plugin-ui-dev-helper.js](https://github.com/GUI-for-Cores/Plugin-Hub/blob/205ecacb0742a185947252cb91e5b11541c32a94/plugins/Generic/plugin-ui-dev-helper.js) | 仅文档/开发参考 | — | 保留为独立开发参考，不在生产路由器开放热重载端口/new Function任意UI执行。 |
| [plugin-ui-example.js](https://github.com/GUI-for-Cores/Plugin-Hub/blob/205ecacb0742a185947252cb91e5b11541c32a94/plugins/Generic/plugin-ui-example.js) | 仅文档/开发参考 | — | 安全配置表单与后端 hook 示例由文档/测试承担；未复制 global Vue/桌面组件宿主。 |
| [plugin-unblockneteasemusic.js](https://github.com/GUI-for-Cores/Plugin-Hub/blob/205ecacb0742a185947252cb91e5b11541c32a94/plugins/Generic/plugin-unblockneteasemusic.js) | 待受管后台服务 | — | 媒体伴随代理需受管服务、架构/ABI与客户端 CA/路由设计；LAN 流量不能用本机进程名替代设备策略，本轮不安装。 |
| [plugin-uwp-loopback-exempt.js](https://github.com/GUI-for-Cores/Plugin-Hub/blob/205ecacb0742a185947252cb91e5b11541c32a94/plugins/Generic/plugin-uwp-loopback-exempt.js) | 桌面/开发平台不适用 | — | Windows AppContainer/CheckNetIsolation 属于客户端系统操作，路由器不能解除客户端沙盒限制。 |
| [plugin-xboard-client.js](https://github.com/GUI-for-Cores/Plugin-Hub/blob/205ecacb0742a185947252cb91e5b11541c32a94/plugins/Generic/plugin-xboard-client.js) | 待专门能力设计 | — | 机场面板账号/订阅管理有价值；需 API 域确认、秘密存储、内容处理和显式工单动作，本轮未发布账号面板。 |

### GFS（13 项）

| 官方源文件 | 决定 | 本轮目标 | 能力边界 / 未移植理由 |
| --- | --- | --- | --- |
| [plugin-add-rulesets.js](https://github.com/GUI-for-Cores/Plugin-Hub/blob/205ecacb0742a185947252cb91e5b11541c32a94/plugins/GFS/plugin-add-rulesets.js) | 已适配部分能力 | [plugin-add-rulesets](../plugins/plugin-add-rulesets.js) | 按显式配置引用 sing-box 远程规则集并可增加路由；不整库导入官方规则列表或写规则库文件。 |
| [plugin-config-override.js](https://github.com/GUI-for-Cores/Plugin-Hub/blob/205ecacb0742a185947252cb91e5b11541c32a94/plugins/GFS/plugin-config-override.js) | 已适配部分能力 | [plugin-config-override](../plugins/plugin-config-override.js) | 提供受限 JSON 深合并/数组追加；保护管理接口和现有监听，不读取任意文件或下载远程片段。 |
| [plugin-fast-delay-test.js](https://github.com/GUI-for-Cores/Plugin-Hub/blob/205ecacb0742a185947252cb91e5b11541c32a94/plugins/GFS/plugin-fast-delay-test.js) | 待受管后台服务 | — | 未加载订阅的独立测试核心需专门作业生命周期；主程序运行核心延迟测试不等价自动清理订阅。 |
| [plugin-import-configuration-to-gui.js](https://github.com/GUI-for-Cores/Plugin-Hub/blob/205ecacb0742a185947252cb91e5b11541c32a94/plugins/GFS/plugin-import-configuration-to-gui.js) | 待专门能力设计 | — | 原生配置到 GUI 的无损、跨资源事务导入尚未实现；不能靠普通配置覆盖替代。 |
| [plugin-native-config-manager.js](https://github.com/GUI-for-Cores/Plugin-Hub/blob/205ecacb0742a185947252cb91e5b11541c32a94/plugins/GFS/plugin-native-config-manager.js) | 部分能力替代 | [plugin-config-override](../plugins/plugin-config-override.js) | 仅提供当前配置的局部 JSON 覆盖；没有完整原生 profile 管理、远程更新或原文与运行覆盖分离。 |
| [plugin-outbound-chain-manager.js](https://github.com/GUI-for-Cores/Plugin-Hub/blob/205ecacb0742a185947252cb91e5b11541c32a94/plugins/GFS/plugin-outbound-chain-manager.js) | 已适配 | [plugin-outbound-chain-manager](../plugins/plugin-outbound-chain-manager.js) | 统一显式 detour 链转换，支持组叶节点，校验成员/既有detour组合环和冲突；不保留桌面链编辑窗口。 |
| [plugin-relay-proxy-helper.js](https://github.com/GUI-for-Cores/Plugin-Hub/blob/205ecacb0742a185947252cb91e5b11541c32a94/plugins/GFS/plugin-relay-proxy-helper.js) | 已合并 | [plugin-outbound-chain-manager](../plugins/plugin-outbound-chain-manager.js) | 合并链路用途为统一 detour 转换；不生成或覆盖用户脚本。 |
| [plugin-share-profile-to-openwrt.js](https://github.com/GUI-for-Cores/Plugin-Hub/blob/205ecacb0742a185947252cb91e5b11541c32a94/plugins/GFS/plugin-share-profile-to-openwrt.js) | 已适配部分能力 | [plugin-router-transparent-proxy](../plugins/plugin-router-transparent-proxy.js) | 提取路由器 TUN/接口/排除网段与可选 DNS 劫持配置；没有跨设备分享服务器或自动系统网络规则。 |
| [plugin-share-profile-to-phone.js](https://github.com/GUI-for-Cores/Plugin-Hub/blob/205ecacb0742a185947252cb91e5b11541c32a94/plugins/GFS/plugin-share-profile-to-phone.js) | 待专门能力设计 | — | 需认证、短期令牌、目标版本适配和路径清理的配置导出；本轮没有手机配置分享服务。 |
| [plugin-sing-box-dashboard.js](https://github.com/GUI-for-Cores/Plugin-Hub/blob/205ecacb0742a185947252cb91e5b11541c32a94/plugins/GFS/plugin-sing-box-dashboard.js) | 主程序承担部分用途 | — | 复用当前主程序原生 API 与监控界面；不另行注入监听或复制旧 Alpha 面板。 |
| [plugin-singbox-builder.js](https://github.com/GUI-for-Cores/Plugin-Hub/blob/205ecacb0742a185947252cb91e5b11541c32a94/plugins/GFS/plugin-singbox-builder.js) | 桌面/开发平台不适用 | — | 完整 Go 编译需开发机/CI 的资源；路由器使用匹配架构的核心构建产物，本轮不提供设备内编译器。 |
| [plugin-sync-singbox-configuration-gists.js](https://github.com/GUI-for-Cores/Plugin-Hub/blob/205ecacb0742a185947252cb91e5b11541c32a94/plugins/GFS/plugin-sync-singbox-configuration-gists.js) | 待专门能力设计 | — | 配置含密钥，需要专用 token、明确选取与有界写接口；本轮没有原生 profile Gists 上传/同步。 |
| [plugin-xray-front-proxy.js](https://github.com/GUI-for-Cores/Plugin-Hub/blob/205ecacb0742a185947252cb91e5b11541c32a94/plugins/GFS/plugin-xray-front-proxy.js) | 待受管后台服务 | — | XHTTP/Reality 前置服务确有需求，但需预转换保真、受管 Xray、架构资产、端口/实例身份和回滚；未发布仅指向不存在 SOCKS 的半成品。 |

### GFC（5 项）

| 官方源文件 | 决定 | 本轮目标 | 能力边界 / 未移植理由 |
| --- | --- | --- | --- |
| [plugin-add-rulesets.js](https://github.com/GUI-for-Cores/Plugin-Hub/blob/205ecacb0742a185947252cb91e5b11541c32a94/plugins/GFC/plugin-add-rulesets.js) | 部分能力替代 | [plugin-add-rulesets](../plugins/plugin-add-rulesets.js) | 合并按需规则引用用途；要求 sing-box source/binary，不转换 Clash YAML/classical 规则内容。 |
| [plugin-proxy-chain-manager.js](https://github.com/GUI-for-Cores/Plugin-Hub/blob/205ecacb0742a185947252cb91e5b11541c32a94/plugins/GFC/plugin-proxy-chain-manager.js) | 已合并 | [plugin-outbound-chain-manager](../plugins/plugin-outbound-chain-manager.js) | 将单节点链语义映射为 sing-box detour；不支持 Mihomo dialer-proxy/provider 宿主。 |
| [plugin-share-config-qrcode.js](https://github.com/GUI-for-Cores/Plugin-Hub/blob/205ecacb0742a185947252cb91e5b11541c32a94/plugins/GFC/plugin-share-config-qrcode.js) | 待专门能力设计 | — | 目标 Mihomo/CMFA 与 sing-box 不同；需要完整转换及认证短期分享，本轮不把 JSON 冒充 YAML。 |
| [plugin-strategy-chain-manager.js](https://github.com/GUI-for-Cores/Plugin-Hub/blob/205ecacb0742a185947252cb91e5b11541c32a94/plugins/GFC/plugin-strategy-chain-manager.js) | 已合并 | [plugin-outbound-chain-manager](../plugins/plugin-outbound-chain-manager.js) | 合并按组展开链路用途，使用已经生成的 sing-box 成员图；不照搬 Clash provider/filter。 |
| [plugin-strategy-group-listener.js](https://github.com/GUI-for-Cores/Plugin-Hub/blob/205ecacb0742a185947252cb91e5b11541c32a94/plugins/GFC/plugin-strategy-group-listener.js) | 已适配部分能力 | [plugin-router-listeners](../plugins/plugin-router-listeners.js) | 生成独立 mixed/http/socks 入站及绑定目标路由，检查配置内端口和 tag；不复制 Clash sub-rule，也不保证系统端口实际空闲。 |

### Extra（1 项）

| 官方源文件 | 决定 | 本轮目标 | 能力边界 / 未移植理由 |
| --- | --- | --- | --- |
| [plugin-x-archive-viewer.js](https://github.com/GUI-for-Cores/Plugin-Hub/blob/205ecacb0742a185947252cb91e5b11541c32a94/plugins/Extra/plugin-x-archive-viewer.js) | 本轮路由范围外 | — | 图片档案浏览不是路由或代理管理；保留独立网页用途，不为它开放路由器文件/UI宿主权限。 |

## 验证含义

源代码审阅和摘要核对不执行第三方脚本、不安装服务，也不保证第三方网站永久可用。本仓库行为测试检查转换、引用、冲突和幂等；实际 Goja 测试覆盖运行时兼容，核心检查覆盖代表性配置。它们不能代替每款路由器的 TUN、DNS、防火墙与资源实测。
