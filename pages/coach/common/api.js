// 教练引流平台接口（SnowmeetApi /api/CoachAdmin、/api/Coach、/api/CoachCard），页面只调这里。
// 保留服务端 code：2 登录失效 / 3 无权限 / 5 这个微信还不是会员，便于页面区分处理
let transport = function (options) { wx.request(options) }

function setTransport(fn) { transport = fn }

function request(method, controller, action, params, body) {
  return new Promise(function (resolve, reject) {
    const g = getApp().globalData
    // globalData.sessionKey 已经 encodeURIComponent 过，原样拼接
    const query = ['sessionKey=' + g.sessionKey].concat(Object.keys(params || {})
      .filter(k => params[k] !== undefined && params[k] !== null && params[k] !== '')
      .map(k => k + '=' + encodeURIComponent(params[k]))).join('&')
    transport({
      url: g.requestPrefix + controller + '/' + action + '?' + query,
      method,
      data: body,
      header: { 'content-type': 'application/json' },
      success(res) {
        if (res.statusCode !== 200) {
          reject({ code: -1, message: '服务暂时繁忙（' + res.statusCode + '），请重试' })
          return
        }
        const d = res.data || {}
        if (d.code === 0) resolve(d.data)
        else reject({ code: d.code, message: d.message || '操作失败', data: d.data })
      },
      fail() { reject({ code: -1, message: '网络不通，请重试' }) }
    })
  })
}

const get = (controller, action, params) => request('GET', controller, action, params)
const post = (controller, action, body) => request('POST', controller, action, {}, body || {})

module.exports = {
  setTransport,
  // ---- 管理员（≥300）----
  listCoaches: () => get('CoachAdmin', 'ListCoaches'),
  getCoach: id => get('CoachAdmin', 'GetCoach', { id }),
  lookupMember: cell => get('CoachAdmin', 'LookupMember', { cell }),
  addCoach: form => post('CoachAdmin', 'AddCoach', form),
  updateCoach: (coachId, name, valid) => post('CoachAdmin', 'UpdateCoach', { coachId, name, valid }),
  // care: [{shop, tier, mode, value}]；rental_rate 为空 = 租赁不优惠
  // 机构自己制作会员卡的底价（下限）：管理员设；min_rate = 最低折扣率，min_fixed = 最低一口价，都空 = 不开放
  getCoachFloors: coachId => get('CoachAdmin', 'GetCoachFloors', { coachId }),
  setCoachFloors: (coachId, care, rentalMinRate) => post('CoachAdmin', 'SetCoachFloors', { coachId, care, rental_min_rate: rentalMinRate }),
  setPricing: (coachId, care, rentalRate) => post('CoachAdmin', 'SetCoachPricing', { coachId, care, rental_rate: rentalRate }),
  listCoachCards: (coachId, status) => get('CoachAdmin', 'ListCoachCards', { coachId, status }),
  revokeCard: cardId => post('CoachAdmin', 'RevokeCard', { cardId }),
  listCouponTemplates: () => get('CoachAdmin', 'ListCouponTemplates'),
  grantCoupons: (coachIds, templateId, countEach, requestId) => post('CoachAdmin', 'GrantCoupons', { coachIds, templateId, countEach, requestId }),
  // ---- 机构自己制作会员卡（Distributor 控制器；教练看到 canEdit=false）----
  getMyCardStandard: () => get('Distributor', 'GetMyCardStandard'),
  saveMyCardStandard: (care, rentalRate) => post('Distributor', 'SaveMyCardStandard', { care, rental_rate: rentalRate }),
  listCardTemplates: () => get('Distributor', 'ListMyCardTemplates'),
  getCardTemplate: id => get('Distributor', 'GetMyCardTemplate', { id }),
  saveCardTemplate: form => post('Distributor', 'SaveMyCardTemplate', form),
  // 机构按管理员设的底价生成自己的优惠券（Distributor 控制器；教练 canMake=false）
  getMyCouponMaker: () => get('Distributor', 'GetMyCouponMaker'),
  makeMyCoupons: form => post('Distributor', 'MakeMyCoupons', form),
  // ---- 教练自己 ----
  getMyCoach: () => get('Coach', 'GetMyCoach'),
  createCard: templateId => post('Coach', 'CreateCard', templateId == null ? {} : { templateId }),
  listMyCards: status => get('Coach', 'ListMyCards', { status }),
  revokeMyCard: cardId => post('Coach', 'RevokeMyCard', { cardId }),
  getStudents: () => get('Coach', 'GetStudents'),
  getStudentOrders: memberId => get('Coach', 'GetStudentOrders', { memberId }),
  getMyCoupons: () => get('Coach', 'GetMyCoupons'),
  // ---- 学员 ----
  getShareCard: t => get('CoachCard', 'GetShareCard', { t }),
  getShareTemplate: t => get('CoachCard', 'GetShareTemplate', { t }),
  claimShareTemplate: t => request('POST', 'CoachCard', 'ClaimShareTemplate', { t }, {}),
  claimShareCard: t => get('CoachCard', 'ClaimShareCard', { t }),
  getMyCards: () => get('CoachCard', 'GetMyCards')
}
