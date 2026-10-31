# WEBUI.for.SingBox 插件中心

为 [Ghostdehole/WEBUI.for.SingBox](https://github.com/Ghostdehole/WEBUI.for.SingBox) 独立维护的 JavaScript 插件仓库，面向路由器、网关及透明代理部署。

在 WebUI 顶部「插件」页面管理和运行脚本，交互方式参考官方桌面版插件页。源码由 Go 后端执行，因此关闭浏览器后定时更新订阅仍生效。本仓库采用 WebUI 的后端接口，官方 [Plugin-Hub](https://github.com/GUI-for-Cores/Plugin-Hub) 中依赖 Wails、桌面窗口或前端 Store 的脚本需要适配。

> 此仓库最初提交中的声明式 JSON 路由预设已撤回，现为实际 JS 脚本插件。当前插件 1.1.0 的图形参数表单需要 WebUI 1.2.1；版本号不代表已创建 Release。

## 已提供的插件

| 插件 | 触发方式 | 功能 |
| --- | --- | --- |
| [防代理重名](plugins/plugin-index-the-proxy-name.js) | 订阅更新 | 按节点顺序添加索引，保持内部出站引用 |
| [更好的代理名称显示](plugins/plugin-modify-proxy-name.js) | 订阅更新 | 地区旗帜、关键词移除、索引 |
| [美化节点名称](plugins/plugin-beautiful-node-name.js) | 订阅更新 / 手动 | 订阅名前缀、地区名称/旗帜、城市名、保留关键词 |
| [重复节点移除](plugins/plugin-duplicate-proxies-removal.js) | 订阅更新 | 仅合并除名称外完整配置相同的节点，保留不同凭据/TLS/协议 |

这些是为后端独立适配的脚本，不宣称与官方桌面脚本逐项兼容。地区识别基于节点名称，不发起 IP 定位请求。插件运行顺序可在页面调整。

## 安装和更新

1. WebUI 顶部「插件 → 插件中心」安装插件，默认启用；安装不会立即执行脚本。
2. 「设置 → 插件」使用开关、单选项、文本框修改参数并自动保存，支持逐项/全部重置。「更多」也可编辑参数与触发器、启停、排序、更新或删除；「源码」可查看、修改和导入导出 JS。
3. 更新订阅时自动触发对应插件。美化插件还可选择已有缓存的订阅手动运行，不重新下载、不自动重启核心。
4. 「检查更新」从本仓库刷新目录，校验通过后才替换完整目录；失败继续使用旧缓存或程序附带目录。
5. 点击某插件的更新才替换已安装源码，保留参数、启停、触发器与顺序。更新会覆盖本地源码修改；独立定制建议使用新 ID。

检查配置后再按需重启核心。插件不直接调整防火墙、dnsmasq、系统路由或桌面系统代理。

## 维护和发布

~~~text
index.json                 # 元数据、默认参数、文件路径、SHA256
plugins/*.js               # 普通 JavaScript 脚本
.github/workflows/validate.yml
~~~

清单协议为 `webui.plugins/v1`。保持 `id` 稳定，修改脚本时递增 `version`。在主程序源码目录运行以下命令，替换为此仓库的实际路径：

参数表单由清单中的 `configuration_schema` 管理：`key/title/description/component/value/options`。`component` 支持 `Switch`、`Radio`、`Input`；`value` 为默认值，`options` 使用 `标签,值` 字符串。安装后 `configuration` 只保存用户覆盖，重置后回到声明的默认值。参数字段和 UI 说明可随插件独立维护。

~~~sh
go run ./cmd/plugin-check -write-index ../WEBUI.for.SingBox-Plugins
go run ./cmd/plugin-check ../WEBUI.for.SingBox-Plugins
~~~

将 JS 与更新后的清单一起提交推送。GitHub Actions 使用主程序的实际解析器检查路径、容量、摘要和 JS 语法。校验器不执行脚本。保持 LF 换行，避免不同平台摘要不一致；不要提交私有节点凭据或用户数据。

插件源码更新可独立发布，不必重新构建 WebUI；主程序离线目录是随其发布时附带的快照。SHA256 用于检查清单与脚本一致性，来源信任仍依赖仓库权限和 HTTPS。

## 后端脚本 API

| 触发器 | 函数 |
| --- | --- |
| `on::subscribe` | `onSubscribe(proxies, subscription)` |
| `on::generate` | `onGenerate(config)` |
| `on::manual` | `onRun(proxies, subscription)` |

返回转换后的 JSON 数据，或原地修改参数并不返回值。参数使用全局 `configuration` 对象；`console.log` 等和 `Plugins.Log` 支持有限日志。不存在 import/export 模块加载、网络、Shell、文件系统和 Wails API。每次调用独立环境，不能依赖全局变量持久化状态。

时间、栈、输入输出及日志均有限制，但 Goja 不提供强内存隔离；只安装可信源码。完整契约、错误处理、配置顺序和资源限制见 [主程序插件说明](https://github.com/Ghostdehole/WEBUI.for.SingBox/blob/main/docs/plugins.md)。

命名参数沿用原版的操作语义：索引可选关闭、全部编号或只处理重名；美化支持订阅名、旗帜、统一地区名称、保留城市和正则关键词。当前地区表覆盖香港、台湾、日本、新加坡、美国、英国、德国、韩国、加拿大、澳大利亚及常见城市，未知名称保持原文；流量和到期提示不做地区识别。地区表可在本仓库继续扩展。

项目许可证见 [LICENSE](LICENSE)。
