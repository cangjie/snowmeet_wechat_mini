# snowmeet 小程序自动化测试

基于微信官方自动化 SDK [`miniprogram-automator`](https://developers.weixin.qq.com/miniprogram/dev/devtools/auto/) + `jest`。
脚本会通过 CLI 启动「微信开发者工具」，加载本项目，然后程序化地跳转页面、读取数据、断言结果。

## 一次性准备

### 1. 开启开发者工具的自动化端口
打开「微信开发者工具」→ 右上角 **设置 → 安全设置** → 打开 **服务端口（CLI/HTTP 调用）**。
记下端口号，确保和 `config.js` 里的 `port`（默认 `9420`）一致。

### 2. 确认 cli 路径
Windows 默认路径：
```
C:\Program Files (x86)\Tencent\微信web开发者工具\cli.bat
```
如果你装在别处，改 `config.js` 的 `cliPath`，或运行时用环境变量 `WX_CLI` 覆盖。

### 3. 安装依赖
在本目录（`automation_test`）下执行：
```bash
npm install
```

## 运行测试
```bash
npm test
```
首次运行会自动拉起开发者工具并编译项目，稍慢属正常。

## 目录结构
```
automation_test/
├── package.json        依赖与 npm scripts
├── jest.config.js      jest 配置（串行执行、超时设置）
├── config.js           cli 路径 / 项目路径 / 端口（支持环境变量覆盖）
├── tests/
│   └── smoke.test.js   示例冒烟用例（启动→跳转→断言）
└── README.md
```

## 怎么扩展用例
照着 `tests/smoke.test.js` 里的写法，在 `tests/` 下新建 `xxx.test.js`。常用 API：

```js
const page = await miniProgram.currentPage()   // 当前页面
await miniProgram.reLaunch('/pages/xxx/xxx')    // 重启到某页
await miniProgram.navigateTo('/pages/xxx/xxx')  // 跳转到某页
const data = await page.data()                  // 读取页面 data
const el = await page.$('.some-class')           // 查找元素
await el.tap()                                   // 点击
await el.input('文本')                            // 输入
const text = await el.text()                     // 读取文本
await page.waitFor(500)                          // 等待
```
完整 API 见官方文档：https://developers.weixin.qq.com/miniprogram/dev/devtools/auto/

## 常见问题
- **连不上工具 / 超时**：检查「服务端口」是否已开启、端口号是否和 `config.js` 一致；先手动打开一次开发者工具。
- **找不到 cli.bat**：核对 `cliPath` 或设置 `WX_CLI` 环境变量。
- **用例里元素找不到**：示例里的选择器（如 `.submit-btn`）是占位符，请按页面真实结构替换。
