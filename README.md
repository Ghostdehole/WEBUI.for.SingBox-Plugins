# WEBUI.for.SingBox 路由器插件目录

为 [Ghostdehole/WEBUI.for.SingBox](https://github.com/Ghostdehole/WEBUI.for.SingBox) 单独维护的插件源，面向网关、旁路由和 OpenWrt / GL.iNet 透明代理。与官方桌面版 Plugin-Hub 的脚本协议不兼容，也不自动引用其插件。

插件是声明式 JSON 数据。主程序在后端生成 sing-box 配置时应用插件，不依赖管理页面保持打开，不执行插件中的 JavaScript、Shell、下载器或系统命令。新增执行能力需要先在主程序实现和验证；此仓库可以独立维护预设、说明、参数和版本。

## 首批插件

| 文件 | 能力 | 使用条件 |
| --- | --- | --- |
| [tun-routing.json](plugins/tun-routing.json) | 为现有 TUN 开启自动路由，配置接口范围和绕过网段 | 选择已启用的 TUN；auto_redirect 需 Linux 与 nftables 支持 |
| [source-routing.json](plugins/source-routing.json) | 按客户端 IPv4/IPv6 CIDR 选择出站 | 选择 TUN 与实际出站，填写客户端地址范围 |
| [dns-hijack.json](plugins/dns-hijack.json) | 接管进入指定 TUN 的 TCP/UDP 53 请求 | 不自动接管发往路由器自身 dnsmasq 的请求 |

## 安装与更新

1. 在 WebUI 中编辑配置，打开「路由器插件」。
2. 从内置目录安装，或点击「检查目录更新」读取本仓库。网络不可用时继续使用已校验缓存或内置目录。
3. 新安装的插件默认禁用。选择当前配置的 TUN / 出站，填写参数后启用。
4. 预览生成配置，保存，再手动重启核心。启停插件或更新目录不会直接修改正在运行的代理。

已安装插件以完整快照保存在主程序的配置中。检查更新只更新目录；点击实例的更新按钮才更新当前编辑草稿，并保留已有参数。改用新预设的默认参数时，应重新安装该预设。更新不自动升级执行协议，不自动改变防火墙、dnsmasq、路由表或系统服务。

也可导入、导出单个插件 JSON，供内网和离线设备使用。不要导入官方桌面版的 JS 插件。

## 维护和发布

目录结构：

~~~text
index.json                 # 文件路径及 SHA256
plugins/*.json             # 独立版本的声明式插件
.github/workflows/validate.yml
~~~

主程序只从本仓库 main 的 index.json 读取清单，校验每个文件的 SHA256、API 版本、字段、大小和引用。一个包失败时保留上一次完整目录，不部分替换。摘要用于核对清单与文件一致性；信任来源仍是本仓库的维护权限和 HTTPS。

修改插件后：

1. 保持 id 稳定并递增 version（语义版本）。apiVersion 当前为 webui.router/v1。
2. 在主程序源码目录执行下列命令；将路径改为此仓库所在目录：

~~~sh
go run ./cmd/router-plugin-check -write-index ../WEBUI.for.SingBox-Plugins
go run ./cmd/router-plugin-check ../WEBUI.for.SingBox-Plugins
~~~

3. 同一个提交中提交插件和更新后的 index.json，再推送 main。GitHub Actions 使用主程序实际解析器验证插件与摘要。

请保持文本 LF 换行，以使工作区、Git 和发布文件摘要一致。不要提交包含私有节点凭据、实际管理地址或敏感内部网段的实例导出。

协议、规则顺序、容量限制和固件差异见主程序的 [插件开发说明](https://github.com/Ghostdehole/WEBUI.for.SingBox/blob/main/docs/router-plugins.md)。

## 兼容边界

- WebUI 的静态构建支持并不代表固件内核模块已就绪；仍需检查 TUN、NET_ADMIN、转发和对应防火墙能力。
- GL-MT3600BE 的厂商固件不能直接假定为 fw4。auto_redirect 默认关闭，需按实际环境选择。
- DNS 插件只处理进入 TUN 的 53 端口流量。路由器 LAN IP / 127.0.0.1 上的 dnsmasq、AdGuard Home、IPv6 RA/DHCP DNS 分发需要单独规划。
- 客户端分流优先于原有路由规则；管理和 NAS 网段应按需加入 TUN 排除地址。DNS 插件优先于客户端分流。
- 不提供桌面托盘、系统代理、UWP、窗口、壁纸等插件。

项目许可证见 [LICENSE](LICENSE)。
