var CryptoJS = require('./cryptoJs.js').CryptoJS; 
//var key = 'skdidhjdksle2345';
// 初始向量 initial vector 16 位
//var iv = 'skdidhjdksle2345';
// key 和 iv 可以一致

//加密
function encrypted(param, key, iv) {
  key = CryptoJS.enc.Utf8.parse(key);
  iv = CryptoJS.enc.Utf8.parse(iv);
  var encrypted = CryptoJS.AES.encrypt(param, key, {
    iv: iv,
    mode: CryptoJS.mode.CBC,
    padding: CryptoJS.pad.Pkcs7
  });
  encrypted = encrypted.toString();
  return encrypted;
}
//解密
function decrypted(param, key, iv) {
  key = CryptoJS.enc.Utf8.parse(key);
  iv = CryptoJS.enc.Utf8.parse(iv);
  var decrypted = CryptoJS.AES.decrypt(param, key, {
    iv: iv,
    mode: CryptoJS.mode.CBC,
    padding: CryptoJS.pad.Pkcs7
  });
  decrypted = CryptoJS.enc.Utf8.stringify(decrypted);
  return decrypted;
}
module.exports = {
  encrypted: encrypted,
  decrypted: decrypted,
}