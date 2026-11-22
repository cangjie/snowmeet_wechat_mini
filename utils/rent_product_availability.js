function isUnavailable(product) {
  const status = String((product && product.status) || '').trim()
  return status !== '' && status !== '正常'
}

module.exports = { isUnavailable }
