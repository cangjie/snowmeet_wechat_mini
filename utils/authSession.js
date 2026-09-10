const adminAssistant = require('./adminAssistant.js')

function resetAuthenticationState(app) {
  if (app && app.globalData) {
    app.globalData.sessionKey = ''
    app.globalData.member = null
    app.globalData.staff = null
  }
  adminAssistant.clearContext()
}

module.exports = { resetAuthenticationState }
