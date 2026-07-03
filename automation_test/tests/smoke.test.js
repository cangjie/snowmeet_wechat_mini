const automator = require('miniprogram-automator')
const config = require('../config')

/**
 * 冒烟测试示例
 *
 * 演示自动化测试的完整骨架：
 *   1. 启动 / 连接微信开发者工具并加载本项目
 *   2. 跳转到指定页面
 *   3. 读取页面路径 / 元素 / 数据并断言
 *   4. 用例结束后关闭连接
 *
 * 你可以照着 it(...) 块的写法，在下面继续追加自己的用例。
 */
describe('snowmeet 小程序冒烟测试', () => {
  /** @type {import('miniprogram-automator').MiniProgram} */
  let miniProgram

  beforeAll(async () => {
    miniProgram = await automator.launch({
      cliPath: config.cliPath,
      projectPath: config.projectPath,
      port: config.port,
    })
  }, config.timeout)

  afterAll(async () => {
    if (miniProgram) {
      await miniProgram.close()
    }
  })

  it('应能正常启动并加载首页', async () => {
    const page = await miniProgram.currentPage()
    expect(page).toBeTruthy()
    // 启动后默认会停在 app.json 的第一个页面 pages/index/index
    expect(page.path).toContain('pages/index/index')
  })

  it('应能跳转到「我的」页面', async () => {
    await miniProgram.reLaunch('/pages/mine/mine')
    const page = await miniProgram.currentPage()
    expect(page.path).toContain('pages/mine/mine')
  })

  it('应能带参数打开订单录入页 order_entry', async () => {
    await miniProgram.reLaunch('/pages/order/order_entry?orderId=60029')
    const page = await miniProgram.currentPage()
    expect(page.path).toContain('pages/order/order_entry')

    // 示例：读取页面 data。按你页面真实字段改这里的断言。
    const data = await page.data()
    expect(data).toBeDefined()

    // 示例：等待并查找页面上的某个元素（按真实结构改选择器）
    // const btn = await page.$('.submit-btn')
    // expect(btn).toBeTruthy()
  })
})
