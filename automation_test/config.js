const path = require('path')

/**
 * 自动化测试连接配置
 *
 * 这些值都可以用环境变量覆盖，方便不同电脑使用，例如：
 *   set WX_CLI="D:\\WeChatDevTools\\cli.bat" && npm test   (Windows cmd)
 *   $env:WX_CLI="..."; npm test                            (PowerShell)
 */
module.exports = {
  // 微信开发者工具 cli 路径（Windows 默认安装位置）
  // 如果你的工具装在别处，改这里或设置环境变量 WX_CLI
  cliPath:
    process.env.WX_CLI ||
    'C:\\Program Files (x86)\\Tencent\\微信web开发者工具\\cli.bat',

  // 被测小程序项目根目录（即 project.config.json 所在目录，也就是上一级）
  projectPath: process.env.WX_PROJECT || path.resolve(__dirname, '..'),

  // 自动化端口：必须和开发者工具里「设置 → 安全设置 → 服务端口」一致
  // 留空则由 miniprogram-automator 自动连接已开启的工具
  port: process.env.WX_PORT ? Number(process.env.WX_PORT) : 9420,

  // 启动 / 连接超时（毫秒）
  timeout: 60000,
}
