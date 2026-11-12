const DESTINATIONS = {
  '崇礼旗舰店': ['万龙服务中心', '万龙体验中心'],
  '万龙体验中心': ['万龙服务中心'],
  '万龙服务中心': ['万龙体验中心'],
}

function destinations(shop) {
  return (DESTINATIONS[String(shop || '').trim()] || []).slice()
}

module.exports = { destinations }
