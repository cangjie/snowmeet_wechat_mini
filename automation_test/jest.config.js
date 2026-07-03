module.exports = {
  testEnvironment: 'node',
  testMatch: ['**/tests/**/*.test.js'],
  // 启动开发者工具 + 编译需要时间，单条用例给足超时
  testTimeout: 120000,
  // 串行执行，避免多个用例同时抢占开发者工具
  maxWorkers: 1,
}
