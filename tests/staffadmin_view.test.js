// 员工账号管理纯函数：状态分类、工作手机状态
const test = require('node:test')
const assert = require('node:assert/strict')
const view = require('../pages/staffadmin/common/staff-view.js')

const bind = (over) => Object.assign({ account_id: 1, cell: '13900007440', is_private: false, has_wechat: true, start_date: '2025-11-01' }, over)
const staff = (over) => Object.assign({ id: 1, name: '李明', gender: '男', title_level: 100, valid: true, base_shop_id: null, binding: bind(), pending_bind: null }, over)

test('viewStaff：手机标签标的是这套手机的属性，不是账号类型', () => {
  assert.equal(view.viewStaff(staff()).typeTag.text, '工作手机')
  assert.equal(view.viewStaff(staff({ binding: bind({ is_private: true }) })).typeTag.text, '私人手机')
  assert.equal(view.viewStaff(staff({ binding: null, pending_bind: { token: 't' } })).typeTag, null)
})

test('classify：在职、待开通、需处理、已离职', () => {
  assert.equal(view.classify(staff()).status, 'active')
  // 待开通只看服务端的 pending_reg（自助登记还没开通）
  assert.equal(view.classify(staff({ valid: false, title_level: 0, pending_reg: true, binding: bind({ is_private: true }) })).status, 'pending')
  assert.equal(view.classify(staff({ valid: false, title_level: 0, binding: null })).status, 'left')
  const loginFail = view.classify(staff({ binding: bind({ login_ok: false }) }))
  assert.equal(loginFail.status, 'attention')
  assert.equal(loginFail.issues[0].code, 'login_fail')
  assert.equal(view.classify(staff({ binding: bind({ login_ok: true }) })).status, 'active')
  assert.equal(view.classify(staff({ valid: false, binding: null })).status, 'left')

  const noPhone = view.classify(staff({ binding: null }))
  assert.equal(noPhone.status, 'attention')
  assert.equal(noPhone.issues[0].code, 'no_phone')

  const holding = view.classify(staff({ valid: false, binding: bind({ cell: '13900001480' }) }))
  assert.equal(holding.status, 'attention')
  assert.match(holding.issues[0].text, /工作手机 ···1480/)

  const noWechat = view.classify(staff({ binding: bind({ has_wechat: false }) }))
  assert.equal(noWechat.status, 'attention')
  assert.equal(noWechat.issues[0].code, 'no_wechat')

  // 已生成绑定码、等员工扫码：算在职，只加提示
  const waiting = view.classify(staff({ binding: null, pending_bind: { token: 't' } }))
  assert.equal(waiting.status, 'active')
  assert.equal(waiting.issues[0].code, 'await_bind')
})

test('filterStaff：按状态筛选；有关键字时在全部账号里按姓名或手机号搜', () => {
  const views = [
    staff({ id: 1, name: '李明' }),
    staff({ id: 2, name: '周婷', binding: bind({ cell: '13900001129' }) }),
    staff({ id: 3, name: '陈晨', valid: false, binding: null })
  ].map(view.viewStaff)
  assert.deepEqual(view.filterStaff(views, 'active', '').map(v => v.id), [1, 2])
  assert.deepEqual(view.filterStaff(views, 'left', '').map(v => v.id), [3])
  assert.deepEqual(view.filterStaff(views, 'active', '陈').map(v => v.id), [3])
  assert.deepEqual(view.filterStaff(views, 'left', '1129').map(v => v.id), [2])
})

test('工作手机状态：在用、离职员工占用、空闲、微信未绑定；只有空闲的能分配', () => {
  const phones = [
    { id: 1, cell: '13900000001', has_wechat: true, holder: { staff_id: 1, name: '甲', valid: true } },
    { id: 2, cell: '13900000002', has_wechat: true, holder: { staff_id: 2, name: '乙', valid: false } },
    { id: 3, cell: '13900000003', has_wechat: true, holder: null },
    { id: 4, cell: '13900000004', has_wechat: false, holder: null }
  ]
  assert.deepEqual(phones.map(view.phoneStatus), ['in_use', 'orphan', 'idle', 'no_wechat'])
  assert.deepEqual(view.assignablePhones(phones).map(p => p.id), [3])
  assert.deepEqual(view.summarizePhones(phones.map(view.viewPhone)), { total: 4, in_use: 1, idle: 1, no_wechat: 1, orphan: 1 })
})

test('offboardEffects：工作手机退回空闲、私人手机结束绑定', () => {
  assert.match(view.offboardEffects(staff())[0], /工作手机 ···7440 退回空闲/)
  assert.match(view.offboardEffects(staff({ binding: bind({ is_private: true }) }))[0], /私人手机 ···7440 的绑定结束/)
})

test('seasonMemo：6 月起算下一雪季，与后端 CreateStaff 一致', () => {
  assert.equal(view.seasonMemo('2026-09-30'), '26-27雪季')
  assert.equal(view.seasonMemo('2026-05-31'), '25-26雪季')
  assert.equal(view.seasonMemo('2026-06-01'), '26-27雪季')
})
