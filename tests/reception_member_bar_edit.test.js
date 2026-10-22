// 开单页顶部顾客条（components/reception/reception_member_bar）：散客填写顾客信息、会员手机号只读、静默匹配会员
const test = require('node:test')
const assert = require('node:assert/strict')
const { loadComponent, settle, tap } = require('./reception_harness.js')

const COMPONENT = 'components/reception/reception_member_bar/reception_member_bar.js'

function setup(customer, lookup) {
  const lookups = []
  const toasts = []
  global.getApp = () => ({ loginPromiseNew: Promise.resolve(), globalData: { sessionKey: 'sk' } })
  global.wx = { showToast(o) { toasts.push(o.title) } }
  const fakeData = {
    getMemberByNumSilentPromise(cell) { lookups.push(cell); return Promise.resolve(lookup ? lookup(cell) : null) },
    getMemberByNumPromise() { throw new Error('应该用静默查询') },
    getMemberAssetsByStaffPromise() { return Promise.resolve(null) }
  }
  const bar = loadComponent(COMPONENT, fakeData, { customer, bizLabel: '租赁' })
  return { bar, lookups, toasts }
}

function cleanup() {
  delete global.getApp
  delete global.wx
}

test('散客在编辑弹层里填姓名、性别、电话', () => {
  const { bar, toasts } = setup({ memberId: null, name: '', cell: '', gender: '' })
  bar.onEditTap()
  assert.equal(bar.data.editing, true)
  bar.onDraftNameInput({ detail: { value: ' 李四 ' } })
  bar.onDraftGenderTap(tap({ value: '女' }))
  bar.onDraftCellInput({ detail: { value: '13900139000' } })
  bar.onEditConfirm()
  assert.equal(bar.data.editing, false)
  assert.deepEqual(bar.events, [{ name: 'customerChange', detail: { name: '李四', gender: '女', cell: '13900139000' } }])
  assert.deepEqual(toasts, [])
  cleanup()
})

test('散客信息都可以不填；再点一次性别取消选择', () => {
  const { bar } = setup({ memberId: null, name: '', cell: '', gender: '男' })
  bar.onEditTap()
  bar.onDraftGenderTap(tap({ value: '男' }))
  bar.onEditConfirm()
  assert.deepEqual(bar.events[0].detail, { name: '', gender: '', cell: '' })
  cleanup()
})

test('手机号格式不对时提示且不提交', () => {
  const { bar, toasts } = setup({ memberId: null, name: '', cell: '', gender: '' })
  bar.onEditTap()
  bar.onDraftCellInput({ detail: { value: '12ab' } })
  bar.onEditConfirm()
  assert.deepEqual(toasts, ['请输入正确手机号'])
  assert.deepEqual(bar.events, [])
  assert.equal(bar.data.editing, true)
  cleanup()
})

test('会员的手机号只读，只能补姓名和性别', () => {
  const { bar } = setup({ memberId: 5, name: '', cell: '13800138000', gender: '' })
  bar.onEditTap()
  bar.onDraftNameInput({ detail: { value: '王五' } })
  bar.onDraftGenderTap(tap({ value: '男' }))
  bar.onDraftCellInput({ detail: { value: '13900139000' } })
  bar.onEditConfirm()
  assert.deepEqual(bar.events[0].detail, { name: '王五', gender: '男', cell: '13800138000' })
  cleanup()
})

test('会员没填姓名时不显示成散客', () => {
  const member = setup({ memberId: 5, name: '', cell: '13800138000', gender: '' })
  member.bar.refreshMask()
  assert.equal(member.bar.data.displayName, '会员（未填姓名）')
  assert.equal(member.bar.data.cellMasked, '138****8000')
  cleanup()

  const walkIn = setup({ memberId: null, name: '', cell: '', gender: '' })
  walkIn.bar.refreshMask()
  assert.equal(walkIn.bar.data.displayName, '散客')
  cleanup()
})

test('散客号码查不到会员时不弹提示，号码不完整时不查', async () => {
  const { bar, lookups, toasts } = setup({ memberId: null, name: '', cell: '1390', gender: '' })
  bar.lookupMemberByCell()
  assert.deepEqual(lookups, [])

  bar.properties.customer = { memberId: null, name: '', cell: '13900139000', gender: '' }
  bar.lookupMemberByCell()
  await settle()
  assert.deepEqual(lookups, ['13900139000'])
  assert.deepEqual(bar.events, [])
  assert.deepEqual(toasts, [])
  cleanup()
})

test('号码匹配到会员时通知开单页挂上会员', async () => {
  const member = { id: 42, real_name: '赵六', gender: '男' }
  const { bar } = setup({ memberId: null, name: '', cell: '0085251234567', gender: '' }, () => member)
  bar.lookupMemberByCell()
  await settle()
  assert.equal(bar.events.length, 1)
  assert.equal(bar.events[0].name, 'memberInfoFound')
  assert.equal(bar.events[0].detail.memberId, 42)
  assert.equal(bar.data.memberFlagText, '会员')
  cleanup()
})
