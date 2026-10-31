# DNS 与客户端策略

两个插件都使用 `onGenerate(config)`，默认 `Enabled: false`、`Rules: "[]"`。只处理生成的 JSON，不联网、不读取系统文件、不执行 shell、不修改系统防火墙。规则匹配和动作直接使用 sing-box 1.14.x 的现有能力：字段核对来自 [DNS 规则源码](https://github.com/SagerNet/sing-box/blob/v1.14.2/option/rule_dns.go)和[路由规则源码](https://github.com/SagerNet/sing-box/blob/v1.14.2/option/rule.go)，并用 1.14.0、1.14.2 实际核心检查代表配置。

这是独立的受限生成器，不是复制 Passwall/OpenClash 的 UCI、防火墙或 DNS 服务管理代码，也不是完整配置导入器。需要保存参数、预览生成结果，确认无误后手动重启核心。核心检查通过不表示流量实际经过 sing-box。

## DNS 分流策略

`plugin-dns-policy` 的每条规则至少有一个匹配条件和一个实际 DNS server 标签：

```json
[
  { "domain_suffix": ["example.org"], "server": "dns-remote" },
  { "source_ip_cidr": ["192.168.8.10/32"], "query_type": ["A", "AAAA"], "server": "dns-local" },
  { "rule_set": ["local-domains"], "server": "dns-local" }
]
```

允许条件为 `domain`、`domain_suffix`、`source_ip_cidr`、`inbound`、`rule_set`、`query_type`。全部使用非空数组；同条规则中的条件遵从核心匹配逻辑。域名采用 ASCII 或 punycode，不填 URL、通配符或端口。查询类型支持 A、AAAA、HTTPS、SVCB、TXT、MX、PTR、SRV、NS、CNAME。`inbound`、`rule_set`、`server` 都必须已存在；不下载规则集、不新建 DNS server。

`Position: "append"` 默认追加，保留现有优先级；如果原规则已经全匹配，追加规则可能不会命中。`"prepend"` 放在普通规则之前，但保留原有 hosts 服务器规则及其前面规则的优先级，不重排任何既有规则。完全相同的规则不会重复追加。插件不改 `dns.final`，不设置 bootstrap、FakeIP、解析策略或 DNS 劫持；全局解析器和复杂响应评估应在配置编辑器中设置。

客户端来源只有在 DNS 请求进入 sing-box 且保留该来源信息时才有意义。转发自路由器 dnsmasq 的查询可能表现为路由器地址；仅靠此插件不能恢复所有 LAN 客户端身份，也不能强制接管客户端访问路由器 LAN IP:53 的 DNS。

## 客户端分流策略

`plugin-client-policy` 每条规则必须明确 `source_ip_cidr`：

```json
[
  { "source_ip_cidr": ["192.168.8.10/32"], "inbound": ["router-tun"], "domain_suffix": ["example.org"], "outbound": "proxy" },
  { "source_ip_cidr": ["192.168.8.20/32"], "network": ["tcp"], "port": [443], "outbound": "direct" },
  { "source_ip_cidr": ["fd00::42/128"], "action": "reject" }
]
```

可追加条件为 `inbound`、`ip_cidr`、`domain`、`domain_suffix`、`rule_set`、`network`（tcp/udp）、`port`（1–65535 整数）。省略 `action` 时为 `route`，需实际出站或端点标签；`reject` 不接受 `outbound`。这些规则不创建出站组、TUN、监听端口或规则集，也不改变 selector 当前选择。

用户填写的规则按数组顺序执行，可先写特定目的例外再写该设备的默认出口。生成位置位于既有 DNS 劫持、sniff/resolve/route-options 前置步骤之后，其余普通规则之前；不重新排列既有规则。前置步骤之前夹有终结路由时会报错，要求先整理原配置顺序。创建 TUN 的插件应先执行；带 `DefaultOutbound` 的 TUN 后执行会因可能遮挡设备规则被拒绝。

已有来源 CIDR 终结规则与新增来源范围重叠时会拒绝，避免和旧 TUN `ClientRules` 或其他设备策略竞争。含来源条件的顶层或祖先 `invert` 规则保守拒绝，不把排除网段误当成实际匹配范围。检查也不用不同目的条件或入站来推断重叠安全。完整重复规则只生成一次。

规则只覆盖进入 sing-box 的连接。系统层面的 LAN 绕过/管理网段请使用 TUN 的排除路由或系统配置；不会因为这里增加 direct 规则就修改系统防火墙、DHCP 或 DNS 服务。分流动作与发往管理界面的流量需按实际环境验证。

旧插件与 TUN 参数迁移见 [迁移说明](migration-1.4.md)。仅在隔离测试和模拟环境执行验证，不使用真实用户路由器。
