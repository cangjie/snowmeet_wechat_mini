module.exports =
/******/ (function(modules) { // webpackBootstrap
/******/ 	// The module cache
/******/ 	var installedModules = {};
/******/
/******/ 	// The require function
/******/ 	function __webpack_require__(moduleId) {
/******/
/******/ 		// Check if module is in cache
/******/ 		if(installedModules[moduleId]) {
/******/ 			return installedModules[moduleId].exports;
/******/ 		}
/******/ 		// Create a new module (and put it into the cache)
/******/ 		var module = installedModules[moduleId] = {
/******/ 			i: moduleId,
/******/ 			l: false,
/******/ 			exports: {}
/******/ 		};
/******/
/******/ 		// Execute the module function
/******/ 		modules[moduleId].call(module.exports, module, module.exports, __webpack_require__);
/******/
/******/ 		// Flag the module as loaded
/******/ 		module.l = true;
/******/
/******/ 		// Return the exports of the module
/******/ 		return module.exports;
/******/ 	}
/******/
/******/
/******/ 	// expose the modules object (__webpack_modules__)
/******/ 	__webpack_require__.m = modules;
/******/
/******/ 	// expose the module cache
/******/ 	__webpack_require__.c = installedModules;
/******/
/******/ 	// define getter function for harmony exports
/******/ 	__webpack_require__.d = function(exports, name, getter) {
/******/ 		if(!__webpack_require__.o(exports, name)) {
/******/ 			Object.defineProperty(exports, name, { enumerable: true, get: getter });
/******/ 		}
/******/ 	};
/******/
/******/ 	// define __esModule on exports
/******/ 	__webpack_require__.r = function(exports) {
/******/ 		if(typeof Symbol !== 'undefined' && Symbol.toStringTag) {
/******/ 			Object.defineProperty(exports, Symbol.toStringTag, { value: 'Module' });
/******/ 		}
/******/ 		Object.defineProperty(exports, '__esModule', { value: true });
/******/ 	};
/******/
/******/ 	// create a fake namespace object
/******/ 	// mode & 1: value is a module id, require it
/******/ 	// mode & 2: merge all properties of value into the ns
/******/ 	// mode & 4: return value when already ns object
/******/ 	// mode & 8|1: behave like require
/******/ 	__webpack_require__.t = function(value, mode) {
/******/ 		if(mode & 1) value = __webpack_require__(value);
/******/ 		if(mode & 8) return value;
/******/ 		if((mode & 4) && typeof value === 'object' && value && value.__esModule) return value;
/******/ 		var ns = Object.create(null);
/******/ 		__webpack_require__.r(ns);
/******/ 		Object.defineProperty(ns, 'default', { enumerable: true, value: value });
/******/ 		if(mode & 2 && typeof value != 'string') for(var key in value) __webpack_require__.d(ns, key, function(key) { return value[key]; }.bind(null, key));
/******/ 		return ns;
/******/ 	};
/******/
/******/ 	// getDefaultExport function for compatibility with non-harmony modules
/******/ 	__webpack_require__.n = function(module) {
/******/ 		var getter = module && module.__esModule ?
/******/ 			function getDefault() { return module['default']; } :
/******/ 			function getModuleExports() { return module; };
/******/ 		__webpack_require__.d(getter, 'a', getter);
/******/ 		return getter;
/******/ 	};
/******/
/******/ 	// Object.prototype.hasOwnProperty.call
/******/ 	__webpack_require__.o = function(object, property) { return Object.prototype.hasOwnProperty.call(object, property); };
/******/
/******/ 	// __webpack_public_path__
/******/ 	__webpack_require__.p = "";
/******/
/******/
/******/ 	// Load entry module and return exports
/******/ 	return __webpack_require__(__webpack_require__.s = 22);
/******/ })
/************************************************************************/
/******/ ({

/***/ 22:
/***/ (function(module, exports, __webpack_require__) {

"use strict";


Component({
  options: {
    addGlobalClass: true
  },
  properties: {
    title: {
      type: String,
      value: '视频上传，最大长度1分钟'
    },
    sizeType: {
      type: Array,
      value: ['original', 'compressed']
    },
    sourceType: {
      type: Array,
      value: ['album', 'camera']
    },
    maxSize: {
      type: Number,
      value: 5 * 1024 * 1024
    },
    maxCount: {
      // 最多上传多少个文件
      type: Number,
      value: 1
    },
    files: {
      // 当前的图片列表, {url, error, loading}
      type: Array,
      value: [],

      observer(newVal) {
        this.setData({
          currentFiles: newVal
        });
      }

    },
    select: {
      // 过滤某个文件
      type: null,
      value: () => {}
    },
    upload: {
      // 返回Promise的一个文件上传的函数
      type: null,
      value: null
    },
    tips: {
      type: String,
      value: ''
    },
    extClass: {
      type: String,
      value: ''
    },
    showDelete: {
      // 是否显示delete按钮
      type: Boolean,
      value: true
    },
    canUpload: {
      type: Boolean,
      value:true
    }
  },
  data: {
    currentFiles: [],
    showPreview: false,
    previewImageUrls: []
  },

  ready() {},

  methods: {
    previewImage(e) {
      const {
        index
      } = e.currentTarget.dataset;
      const previewImageUrls = [];
      this.data.files.forEach(item => {
        previewImageUrls.push(item.url);
      });
      this.setData({
        previewImageUrls,
        previewCurrent: index,
        showPreview: true
      });
    },

    chooseVideo() {
      if (this.uploading) return;
      var that = this
      wx.chooseMedia({
        count: 1,
        maxDuration: 60,
        sourceType:['album'],
        sizeType:['compressed'],
        mediaType:['video'],
        success: res => {
          // console.log('chooseVideo resp', res)
          // 首先检查文件大小
          let invalidIndex = -1; // @ts-ignore
/*
          res.tempFilePath.forEach((item, index) => {
            if (item.size > this.data.maxSize) {
              invalidIndex = index;
            }
          });
*/
          if (typeof that.data.select === 'function') {
            const ret = that.data.select(res);

            if (ret === false) {
              return;
            }
          }

          if (invalidIndex >= 0) {
            that.triggerEvent('fail', {
              type: 1,
              errMsg: `chooseVideo:fail size exceed ${that.data.maxSize}`,
              total: res.tempFilePaths.length,
              index: invalidIndex
            }, {});
            return;
          } // 获取文件内容


          const mgr = wx.getFileSystemManager();


          var uploadedFile = res.tempFiles[0]

          

          
          
          

          const thumbContent = mgr.readFileSync(uploadedFile.thumbTempFilePath, "base64", 0)
          const content = ''//mgr.readFileSync(uploadedFile.tempFilePath, "base64", 0)

          wx.getFileInfo({
            filePath: uploadedFile.tempFilePath,
            success:(res)=>{
              var position = 0
              var content = ''
              for(;position < res.size;) {
                var length = Math.min(1024*1024, res.size - position)
                content = content + mgr.readFileSync(uploadedFile.tempFilePath, 'base64', position, length)
                position = position + length
              }
              const obj = {
                tempFilePath: uploadedFile.tempFilePath,
                thumbTempFilePath: uploadedFile.thumbTempFilePath,
                //tempFiles: res.tempFiles,
                content,
                thumbContent
              }; // 触发选中的事件，开发者根据内容来上传文件，上传了把上传的结果反馈到files属性里面
              that.triggerEvent('select', obj, {});
              const files = [{
                loading: true,
                  // @ts-ignore
                url: `data:Video/mp4;base64,${content}`
              },
              {
                loading: true,
                // @ts-ignore
                url: `data:image/jpg;base64,${thumbContent}`
      
              }];
              if (!files || !files.length) return;
              if (typeof that.data.upload === 'function') {
                const len = that.data.files.length;
                const newFiles = that.data.files.concat(files);
                that.setData({
                  files: newFiles,
                  currentFiles: newFiles
                });
                that.loading = true;
                that.data.upload(obj).then(json => {
                  that.loading = false;
    
                  if (json.urls) {
                    const oldFiles = that.data.files;
                    json.urls.forEach((url, index) => {
                      oldFiles[len + index].url = url;
                      oldFiles[len + index].loading = false;
                    });
                    that.setData({
                      files: oldFiles,
                      currentFiles: newFiles
                    });
                    that.triggerEvent('success', json, {});
                  } else {
                    that.triggerEvent('fail', {
                      type: 3,
                      errMsg: 'upload file fail, urls not found'
                    }, {});
                  }
                }).catch(err => {
                  that.loading = false;
                  const oldFiles = that.data.files;
                  res.tempFilePaths.forEach((item, index) => {
                    oldFiles[len + index].error = true;
                    oldFiles[len + index].loading = false;
                  });
                  that.setData({
                    files: oldFiles,
                    currentFiles: newFiles
                  });
                  that.triggerEvent('fail', {
                    type: 3,
                    errMsg: 'upload file fail',
                    error: err
                  }, {});
                });
              }
            }
          })
          
        },
        fail: fail => {
          if (fail.errMsg.indexOf('chooseVideo:fail cancel') >= 0) {
            this.triggerEvent('cancel', {}, {});
            return;
          }

          fail.type = 2;
          this.triggerEvent('fail', fail, {});
        }
      });
    },

    deletePic(e) {
      const index = e.detail.index;
      const files = this.data.files;
      const file = files.splice(index, 1);
      this.setData({
        files,
        currentFiles: files
      });
      this.triggerEvent('delete', {
        index,
        item: file[0]
      });
    }

  }
});

/***/ })

/******/ });