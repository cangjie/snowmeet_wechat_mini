// utils/member_equipment_diff.js
// 会员装备字段规范化、双板左右序列号拆合、以及养护开单「修改已有装备」变更检测纯函数。

function normalizeText(v) {
  if (v == null) return '';
  return String(v).trim();
}

function normalizeSerials(raw) {
  const s = normalizeText(raw);
  if (!s || s === '|') return '';
  if (s.indexOf('|') >= 0) {
    const parts = s.split('|');
    const left = normalizeText(parts[0]);
    const right = normalizeText(parts.slice(1).join('|'));
    if (!left && !right) return '';
    return left + '|' + right;
  }
  return s;
}

function splitSerials(raw) {
  const norm = normalizeSerials(raw);
  if (!norm) {
    return { diff: false, serials: '', leftSerial: '', rightSerial: '' };
  }
  const idx = norm.indexOf('|');
  if (idx >= 0) {
    return {
      diff: true,
      serials: norm,
      leftSerial: norm.slice(0, idx),
      rightSerial: norm.slice(idx + 1),
    };
  }
  return { diff: false, serials: norm, leftSerial: '', rightSerial: '' };
}

function composeSerials(diff, single, left, right) {
  if (diff) {
    return normalizeSerials(normalizeText(left) + '|' + normalizeText(right)) || null;
  }
  return normalizeSerials(single) || null;
}

function formatSerialsDisplay(raw) {
  const norm = normalizeSerials(raw);
  if (!norm) return '';
  const idx = norm.indexOf('|');
  if (idx >= 0) {
    const left = norm.slice(0, idx) || '无';
    const right = norm.slice(idx + 1) || '无';
    return '左:' + left + ' / 右:' + right;
  }
  return norm;
}

const EQUIPMENT_DIFF_LABELS = { equipment: '类型', brand: '品牌', scale: '长度', serials: '序列号' };

// 养护订单详情页的标注文字。diffs 是后端给的 equipmentDiffs（订单和装备列表里对应那件不一样的项），逐项写出装备列表里的值。
function formatEquipmentDiffs(diffs) {
  if (!Array.isArray(diffs)) return [];
  return diffs
    .filter((d) => d && EQUIPMENT_DIFF_LABELS[d.field])
    .map((d) => {
      const value = d.field === 'serials' ? formatSerialsDisplay(d.listValue) : normalizeText(d.listValue);
      return { field: d.field, text: '装备列表中的' + EQUIPMENT_DIFF_LABELS[d.field] + '：' + (value || '未填') };
    });
}

function brandShortName(brand) {
  const s = normalizeText(brand);
  return s ? s.split('/')[0] : '';
}

function snapshotFromEquipment(item) {
  if (!item || !(Number(item.id) > 0)) return null;
  return {
    id: Number(item.id),
    equipment: normalizeText(item.equipment),
    brand: normalizeText(item.brand),
    scale: normalizeText(item.scale),
    serials: normalizeSerials(item.serials),
    image_id: Number(item.image_id) > 0 ? Number(item.image_id) : null,
  };
}

function formatSingleFieldChange(care, origin, field, prevVal, nextVal) {
  const equip = normalizeText((origin && origin.equipment) || (care && care.equipment)) || '装备';
  const prevBrand = field === 'brand'
    ? normalizeText(prevVal)
    : normalizeText((origin && origin.brand) || (care && care.brand));
  const prevScale = field === 'scale'
    ? normalizeText(prevVal)
    : normalizeText((origin && origin.scale) || (care && care.scale));
  const summaryParts = [equip];
  const shortBrand = brandShortName(prevBrand);
  if (shortBrand) summaryParts.push(shortBrand);
  if (prevScale) summaryParts.push(prevScale + 'cm');

  let changeLine = '';
  if (field === 'brand') {
    changeLine = '品牌：' + (normalizeText(prevVal) || '未填') + ' → ' + (normalizeText(nextVal) || '未填');
  } else if (field === 'scale') {
    const fromScale = normalizeText(prevVal) ? normalizeText(prevVal) + 'cm' : '未填';
    const toScale = normalizeText(nextVal) ? normalizeText(nextVal) + 'cm' : '未填';
    changeLine = '长度：' + fromScale + ' → ' + toScale;
  } else if (field === 'serials') {
    const fromSerial = formatSerialsDisplay(prevVal) || '未填';
    const toSerial = formatSerialsDisplay(nextVal) || '未填';
    changeLine = '序列号：' + fromSerial + ' → ' + toSerial;
  } else {
    changeLine = normalizeText(field) + '：' + (normalizeText(prevVal) || '未填') + ' → ' + (normalizeText(nextVal) || '未填');
  }

  return {
    equipSummary: summaryParts.join(' · '),
    changeLine,
  };
}

function formatModifiedBannerText(changes) {
  if (!changes || changes.length === 0) return '';
  const labels = [];
  changes.forEach((ch) => {
    if (ch && ch.label && labels.indexOf(ch.label) < 0) {
      labels.push(ch.label);
    }
  });
  if (labels.length === 0) return '';
  return '已修改' + labels.join('、') + '，下单时将更新原装备';
}

// 检测一件已关联会员装备（member_equipment_id > 0 且有原始快照 origin）的 care 是否被修改了字段
function diffCareAgainstOrigin(care, origin) {
  if (!care || !origin) return [];
  const equipId = Number(care.member_equipment_id) || 0;
  if (equipId <= 0 || Number(origin.id) !== equipId) return [];

  const changes = [];
  const oldEquip = normalizeText(origin.equipment);
  const newEquip = normalizeText(care.equipment);
  if (oldEquip && newEquip && oldEquip !== newEquip) {
    changes.push({
      field: 'equipment',
      label: '类型',
      from: oldEquip,
      to: newEquip,
    });
  }

  const oldBrand = normalizeText(origin.brand);
  const newBrand = normalizeText(care.brand);
  if (oldBrand !== newBrand) {
    changes.push({
      field: 'brand',
      label: '品牌',
      from: oldBrand || '未填',
      to: newBrand || '未填',
    });
  }

  const oldScale = normalizeText(origin.scale);
  const newScale = normalizeText(care.scale);
  if (oldScale !== newScale) {
    changes.push({
      field: 'scale',
      label: '长度',
      from: oldScale ? oldScale + 'cm' : '未填',
      to: newScale ? newScale + 'cm' : '未填',
    });
  }

  const oldSerial = normalizeSerials(origin.serials);
  const newSerial = normalizeSerials(care.serials);
  if (oldSerial !== newSerial) {
    changes.push({
      field: 'serials',
      label: '序列号',
      from: formatSerialsDisplay(oldSerial) || '未填',
      to: formatSerialsDisplay(newSerial) || '未填',
    });
  }

  return changes;
}

// 汇总整张开单里所有被修改过的「已有会员装备」，生成弹窗提示文本
function collectModifiedEquipments(cares) {
  const list = [];
  (cares || []).forEach((care, idx) => {
    if (!care || care.is_cancel) return;
    const origin = care._equipOrigin || care.equipOrigin || null;
    const changes = diffCareAgainstOrigin(care, origin);
    if (changes.length === 0) return;
    const titleParts = [origin.equipment || care.equipment || '装备'];
    const b = brandShortName(origin.brand || care.brand);
    if (b) titleParts.push(b);
    if (origin.scale) titleParts.push(origin.scale + 'cm');
    list.push({
      index: idx,
      equipmentId: Number(care.member_equipment_id),
      title: titleParts.join(' · '),
      changes,
    });
  });
  return list;
}

function formatConfirmContent(modifiedList) {
  if (!modifiedList || modifiedList.length === 0) return '';
  const blocks = modifiedList.map((item) => {
    const lines = item.changes.map((ch) => '  · ' + ch.label + '：' + ch.from + ' → ' + ch.to);
    return '【' + item.title + '】\n' + lines.join('\n');
  });
  return '检测到已选装备信息有修改，确认同步更新到会员装备列表并记录修改历史？\n\n' + blocks.join('\n\n');
}

module.exports = {
  ExplicitNewSentinel: -1,
  normalizeText,
  normalizeSerials,
  splitSerials,
  composeSerials,
  formatSerialsDisplay,
  formatEquipmentDiffs,
  brandShortName,
  snapshotFromEquipment,
  diffCareAgainstOrigin,
  collectModifiedEquipments,
  formatConfirmContent,
  formatSingleFieldChange,
  formatModifiedBannerText,
};
