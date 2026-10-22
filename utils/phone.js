// utils/phone.js
// 店员手输顾客手机号用的校验（业务开单入口、开单页顶部顾客条共用）

// 把用户输入归一化：去掉空格/横杠/括号，0044... → +44...
function normalizePhone(raw) {
  let normalized = String(raw || '').trim().replace(/[\s\-()]/g, '');
  if (normalized.startsWith('00')) {
    normalized = '+' + normalized.slice(2);
  }
  return normalized;
}

function isValidInternationalPhone(raw) {
  const value = String(raw || '').trim();
  if (!value) return false;

  // 允许国际常见输入形式：+65 8123 4567 / (852) 5123-4567 / 0044 7700 900123
  const normalized = normalizePhone(value);

  if (normalized.startsWith('+')) {
    // E.164: + 后 6~15 位数字，首位不能是 0
    return /^\+[1-9]\d{5,14}$/.test(normalized);
  }

  // 未带国家区号时，兼容本地写法：7~15 位数字（覆盖 US/HK/SG/EU 常见长度）
  return /^\d{7,15}$/.test(normalized);
}

// 号码是否「完整到可以拿去查会员」：明确带国家区号(+) 或 国内 11 位手机号。
// 避免在国内号码输到 7~10 位（isValidInternationalPhone 已为 true）时就反复发查询。
function shouldLookupPhone(normalized) {
  if (!isValidInternationalPhone(normalized)) return false;
  if (normalized.startsWith('+')) return true;
  return /^\d{11}$/.test(normalized);
}

module.exports = {
  normalizePhone,
  isValidInternationalPhone,
  shouldLookupPhone,
};
