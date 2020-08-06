/* 秘钥 */
var _mikey = 'abcdefgABCDEFG123456';
/* 引用AES源码js */
var CryptoJS = require('./cryptoJs.js').CryptoJS; 

/* 加密 */
const aesEncrypt = (word, keyStr) => { 
    keyStr = keyStr ? keyStr : _mikey;
    var key  = CryptoJS.enc.Utf8.parse(keyStr);
    var srcs = CryptoJS.enc.Utf8.parse(word);
    var encrypted = CryptoJS.AES.encrypt(srcs, key, {mode:CryptoJS.mode.ECB,padding: CryptoJS.pad.Pkcs7});
    return encrypted.toString();
}

/* 解密 */
const aesDecrypt = (word, keyStr) => {
  keyStr = keyStr ? keyStr : _mikey;
  var key = CryptoJS.enc.Utf8.parse(keyStr);
  var decrypt = CryptoJS.AES.decrypt(word, key, { mode: CryptoJS.mode.ECB, padding: CryptoJS.pad.Pkcs7 });
  return CryptoJS.enc.Utf8.stringify(decrypt).toString();
}

/* 暴露接口 */
module.exports = {
  aesEncrypt : aesEncrypt,
  aesDecrypt : aesDecrypt
}