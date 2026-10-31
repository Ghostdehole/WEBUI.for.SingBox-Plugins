# 来源与许可说明

本仓库是 **Ghostdehole/WEBUI.for.SingBox-Plugins**，为路由器上的 WEBUI.for.SingBox 独立维护。它不是 GUI-for-Cores 官方插件仓库，也不是桌面插件宿主的完整实现。

## 上游来源

- **GUI.for.Cores 及 GUI-for-Cores/Plugin-Hub 贡献者**：本轮固定在 [Plugin-Hub `205ecacb0742a185947252cb91e5b11541c32a94`](https://github.com/GUI-for-Cores/Plugin-Hub/tree/205ecacb0742a185947252cb91e5b11541c32a94)。该提交的 [package.json](https://github.com/GUI-for-Cores/Plugin-Hub/blob/205ecacb0742a185947252cb91e5b11541c32a94/package.json) 声明 `author: "GUI.for.Cores"`、`license: "GPL-3.0"`。
- 宿主行为参考 [GUI.for.SingBox `f0de129e3c7ee0278eff12f13bbfa435fcc8e57d`](https://github.com/GUI-for-Cores/GUI.for.SingBox/tree/f0de129e3c7ee0278eff12f13bbfa435fcc8e57d)，用于核对 API、配置及桌面依赖，不表示包含该宿主全部代码。
- **WEBUI.for.SingBox-Plugins 贡献者**：实现后端受限 hook、节点身份/引用修复、幂等/冲突处理、路由配置适配、受限诊断和相关测试。
- **SagerNet/sing-box**：[v1.14.2 DNS 规则](https://github.com/SagerNet/sing-box/blob/v1.14.2/option/rule_dns.go)及[路由规则](https://github.com/SagerNet/sing-box/blob/v1.14.2/option/rule.go)用于核对核心字段、标签引用和匹配语义。DNS/客户端策略是本仓库独立编写的 JavaScript 生成器，未复制 sing-box Go 实现，也未复制 Passwall/OpenClash 的 UCI 或系统防火墙脚本。

上游 GPL-3.0 声明原样保留，不擅自扩展成 GPL-3.0-or-later。本仓库适配代码及随附来源数据按 **GPL-3.0-only** 分发，完整许可正文见 [LICENSE](LICENSE)。

## 对应关系与修改

每个官方插件的固定源路径、链接、原始 Git blob SHA256、依赖审阅和本轮目标 ID 均在 [upstream/audit.json](upstream/audit.json)，[中文审计](docs/upstream-review.md) 说明最终取舍。100 项是审计记录，不表示复制或发布全部脚本；`Resources/plugin-ui-dev-helper/hotreload.js` 是另列摘要的支持资源，不计为插件入口。

地区数据来自官方 `plugins/Generic/plugin-beautiful-node-name.js` 的 `RegionData` 和 `plugin-modify-proxy-name.js` 的兼容别名，共 142 地区、907 关键词。数据及调整说明保存在 [sources/naming](sources/naming/NOTICE.md)，离线构建后内联进独立脚本，不运行远程 ESM。

适配把桌面 UI/store 操作拆为后端 JSON 转换或认证诊断；多个链路插件合并为 detour 管理。Hosts 改为 sing-box DNS 作用域配置；AdGuardHome 仅对接已运行服务；透明代理与独立端口仅生成核心配置；测速改为限量流式样本。URLTest 是基础自动选择替代，未复制 EWMA/日志故障转移算法。Windows/macOS 系统操作、外部 daemon 安装器、任意 shell、文件和浏览器脚本注入未直接搬入。

1.4 将三个命名策略与去重合并到订阅整理，将出口与 IP 查询合并到网络诊断；6 个旧 ID 仍保留兼容，源码/参数不会自动替换。当前发行 14 个不同用途的插件，另有 6 个兼容条目。新订阅筛选、策略生成、迁移冲突检查和测试由本仓库贡献者实现，来源映射不等于所有官方功能已移植。

仓库不随插件打包或自动安装上游脚本引用的第三方二进制、模型、远端 UI 和服务。第三方名称用于说明互操作与来源，不表示其认可本项目。
