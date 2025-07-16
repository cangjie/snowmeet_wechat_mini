const spyun =  () => {
    //appid和appsecret 在商鹏（ http://developer.spyun.net/#/ucenter）管理后台的个人中心可以查看
    var appid = 'sp68771a4656182';//必填
    var appsecret = 'f0005014748c24ee892a73abda5fb5dd';//必填

    var SN = '1928691161';//必填，打印机编号,打印机必须要在管理后台先添加

    //以下URL参数不需要修改
    var HOST = "open.spyun.net";     //域名
    var STIME = new Date().getTime();//请求时间,当前时间的秒数
    
    //标签说明：
    //  <BR> ：换行符
    // <CUT> ：切刀指令(主动切纸,仅限切刀打印机使用才有效果) 
    // <IMAGE> ：打印图片指令(前提是预先在机器内置图片,出厂时设置好)
    // <L1></L1>：放大一倍
    // <L2></L2>：放大两倍
    // <C></C>：居中,该标签可以与DL,L,H,W嵌套
    // <C><L1></L1></C>：居中放大一倍（可嵌套）
    // <H></H>：字体变高一倍
    // <W></W>：字体变宽一倍
    // <R></R>：右对齐
    // <B></B>：字体加粗
    // <QRCODE></QRCODE>：二维码，单个订单只能打印一个二维码
    // <BC128_C></BC128_C>：条形码（一维条码）,数字条形码

    //拼凑订单内容时可参考如下格式
    //根据打印纸张的宽度，自行调整内容的格式，可参考下面的样例格式

    var orderInfo;
    orderInfo = '<C><L1>小程序</L1></C><BR>';
    orderInfo += '名称　　　　　 单价  数量 金额<BR>';
    orderInfo += '--------------------------------<BR>';
    orderInfo += '饭　　　　　 　10.0   10  10.0<BR>';
    orderInfo += '炒饭　　　　　 10.0   10  10.0<BR>';
    orderInfo += '蛋炒饭　　　　 10.0   100 100.0<BR>';
    orderInfo += '鸡蛋炒饭　　　 100.0  100 100.0<BR>';
    orderInfo += '西红柿炒饭　　 1000.0 1   100.0<BR>';
    orderInfo += '西红柿蛋炒饭　 100.0  100 100.0<BR>';
    orderInfo += '西红柿鸡蛋炒饭 15.0   1   15.0<BR>';
    orderInfo += '备注：加辣<BR>';
    orderInfo += '--------------------------------<BR>';
    orderInfo += '合计：xx.0元<BR>';
    orderInfo += '送货地点：广州市南沙区xx路xx号<BR>';
    orderInfo += '联系电话：13888888888888<BR>';
    orderInfo += '订餐时间：2014-08-08 08:08:08<BR>';
    orderInfo += '<QRCODE>http://www.spyun.net/</QRCODE>';//把二维码字符串用标签套上即可自动生成二维码

    //***接口返回值说明***
    //正确例子：
    // {
    //   "errorcode":0,
    //   "id":"5c1af88568e417349343b942",    // 打印订单ID,查询订单状态时需要用到
    //   "create_time":"2019-01-01 00:00:00" // 订单接收时间
    // }
    //错误：
    // {
    //   "errorcode":-1,
    //   "errormsg":"appid为空"
    // }
    // console.log(orderInfo);
    //打开注释可测试
    prints(SN,orderInfo,1);
    
    function makeSign(appid, timestamp, appsecret, orderInfo, sn,times) {
      var mycars = new Array()
      mycars['appid'] = appid
      mycars['timestamp'] = timestamp
      mycars['sign'] = appsecret
      mycars['sn'] = sn
      mycars['content'] = orderInfo
      mycars['times'] = times
      var sign = '';
      Object.keys(mycars).sort().forEach(function (k, i) {
        if (k != 'sign' && k != 'appsecret' && mycars[k] !== '' && mycars[k] !== null && mycars[k] != undefined) {
          if (i > 0) {
            sign += '&';
          }
          sign += k + '=' + mycars[k];
        }
      });
      sign += "&appsecret=" + appsecret;
      var md_5 = require('./md5.js');//注意把md5文件放到对应的位置，小程序的utils文件夹内
      sign = md_5.md5(sign);//进行md5加密
      sign = sign.toLocaleUpperCase();
      return sign
    }

    /*
    *  打印订单接口：prints
    */
    function prints(sn, orderInfo, times) {
      var sign = makeSign(appid,STIME,appsecret,orderInfo,sn,times);//获取签名
      wx.request({
        url: 'https://'+HOST+'/v1/printer/print',
        data: {
          appid: appid,
          timestamp: STIME,//当前时间的秒数
          sign: sign,//签名
          sn: sn,//打印机编号
          content: orderInfo,//打印内容
          times: times,//打印联数,默认为1
        },
        method: "POST",
        header: {
          "content-type": "application/x-www-form-urlencoded"
        },
        success: function (res) {
          console.log(res.data)
        }
      })
    }
  }
  module.exports = {
    print: spyun
  }
