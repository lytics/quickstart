/**
* @class ds
 * The base javascript utilities for lytics.io Javascript
 *
 * @alias lio
 * @singleton
 * lytics.io  :  base  js lib
 * 
 * Copyright (c) 2012 lytics.io, Inc.
 * All rights reserved.
 * 
 */  
(function(win,doc) {
  var dloc = doc.location
    , context = this
    , ckie = doc.cookie
    , lio = win.lio ? win.lio : {}
    , l = 'length'
    , cache = {}
    , as = Array.prototype.slice
    , otostr = Object.prototype.toString;
  
  win['lio'] = lio;

  if (!win.console){
   win.console = {log:function(){}};
  }

  /*
      parseUri 1.2.1
      (c) 2007 Steven Levithan <stevenlevithan.com>
      http://stevenlevithan.com/demo/parseuri/js/
      MIT License
  */
  function parseUri(str) {
      if (str == undefined){
          str = window.location.href;
      }
      var o   =  {
          strictMode: false,
          key: ["source","protocol","authority","userInfo","user","password","host","port","relative","path","directory","file","query","anchor"],
          q:   {
              name:   "queryKey",
              parser: /(?:^|&)([^&=]*)=?([^&]*)/g
          },
          parser: {
              strict: /^(?:([^:\/?#]+):)?(?:\/\/((?:(([^:@]*):?([^:@]*))?@)?([^:\/?#]*)(?::(\d*))?))?((((?:[^?#\/]*\/)*)([^?#]*))(?:\?([^#]*))?(?:#(.*))?)/,
              loose:  /^(?:(?![^:@]+:[^:@\/]*@)([^:\/?#.]+):)?(?:\/\/)?((?:(([^:@]*):?([^:@]*))?@)?([^:\/?#]*)(?::(\d*))?)(((\/(?:[^?#](?![^?#\/]*\.[^?#\/.]+(?:[?#]|$)))*\/?)?([^?#\/]*))(?:\?([^#]*))?(?:#(.*))?)/
          }
      }
      var m   = o.parser[o.strictMode ? "strict" : "loose"].exec(str),
          uri = {},
          i   = 14;
      while (i--) uri[o.key[i]] = m[i] || "";
      uri[o.q.name] = {};
      uri[o.key[12]].replace(o.q.parser, function ($0, $1, $2) {
          if ($1) uri[o.q.name][$1] = $2;
      });
      return uri;
  }

  /**
   * the public config settings, can be set in advance 
   *
   * @cfg {Object} config just object of properties
   * @cfg {String} [config.url='http://api.lytics.io']
   * @cfg {String} [config.apiUrl='http://api.lytics.io']
   * @cfg {String} [config.id=""] 
   */
  lio.config = {
    url:'http://api.lytics.io',
    apiUrl:'http://api.lytics.io',
    rtApi:'http://api.lytics.io',
    vizUrl:'http://static.lytics.io',
    Q:[],
    id: lio.id || undefined,
    cid : undefined,
    authu:null
  }

  function objType(it,oname) {
    return otostr.call(it) === "[object " + oname + "]";
  }
  lio.isFn = function(it){return objType(it,'Function')};
  lio.isObject = function(it){return objType(it,'Object')};
  lio.isString = function(it){return objType(it,'String')};
  lio.isArray = function(it){return objType(it,'Array')};

  /**
   * the classic extend, nothing special about this
   * @param target
   * @param source
   * @param overwrite (bool, optional) to overwrite
   *   target with source properties default = false.
   * @returns target
  */
  lio.extend = function(target, source,overwrite){
    if (!source) return target;
    for (p in source){
      if (source.hasOwnProperty(p) && (!(p in target) || overwrite)){
        target[p] = source[p]
      }
    }
    return target;
  }

  /**
   * Walk, accepts string representing of a js object path
   *  it parses  on dots, and walks the tree to get said object.
   *  by doing this it can safely retrieve objects without errors
   *  and return null if object, or some portion doesn't exist.
   * 
   * @param dotnames  json dot notation path:    lio.widgets.config.css.table
   * @param base   base object to start from, if not supplied uses
   *   the windows context.
   * @param defval  defalut value, optional
  */
  function walk(dotnames, base, defval){
    if (arguments[l] < 3) defval = null;
    if (arguments[l] <2 ) base = win;
    if (!dotnames) return defval;
    var names = dotnames.split("."),
      pointer = base;
    if (!pointer) return defval;
    names.forEach(function(name){
      if (pointer && name in pointer){
        pointer = pointer[name];
      } else {
        pointer = defval;// not found
      }
    })
    return pointer;
  }
  lio['walk'] = walk;

  /**
   * The connect function accepts
   */
  function connect(opts,cb){
    lio.extend(lio.config,opts,true)
    if (!lio.config.id && lio.config.cid) {
      lio.config.id = lio.config.cid
    }
    console.log(o)
  }
  if ('_c' in lio) connect(lio._c)

  if (!lio.config.id && !lio.config.cid) {
    var o = parseUri()
    if (o.queryKey && o.queryKey.aid) {
      lio.config.id = o.queryKey.aid 
      lio.config.cid = o.queryKey.aid
    }
  }

  lio["init"] = lio['connect'] = connect;

  /**
   * Get a cookie
   */
  function ckieGet(name){
    if (ckie[l] > 0) { 
      var begin = ckie.indexOf(name+"="); 
      if (begin != -1) { 
        begin += name.length+1; 
        end = ckie.indexOf(";", begin);
        if (end == -1) end = ckie[l];
        return unescape(ckie.substring(begin, end)); 
      } 
    }
    return null; 
  }
  lio['ckieGet'] = ckieGet;

  function ckieDel(name) {
    doc.cookie=name+"=; path=/; expires=Monday, 19-Aug-1996 05:00:00 GMT";
  }
  lio['ckieDel'] = ckieDel

  function ckieSet(name, value, expires, path, domain, secure) {
    ckie = name + "=" + escape(value) +
        ((expires) ? "; expires=" + expires.toGMTString() : "") +
        ((path) ? "; path=" + path : "") +
        ((domain) ? "; domain=" + domain : "") +
        ((secure) ? "; secure" : "");
  }
  lio['ckieSet'] = ckieSet;

  function loadScript(src){
    var js,fjs = doc.getElementsByTagName("script")[0];
    js=doc.createElement("script"); 
    js.src=src;
    fjs.parentNode.insertBefore(js, fjs);
  }
  lio['loadScript'] = loadScript

  function loadCss(filename,cb){
     var f=doc.createElement('link');
     f.setAttribute("rel","stylesheet");f.setAttribute("type","text/css");
     f.setAttribute("href", filename);
     doc.getElementsByTagName("head")[0].appendChild(f);
  }
  lio['loadCss'] = loadCss
  
  lio['loadTemplate'] = function(name,source){
    var template = $e.create('<div id="' + name + '">' + source + '</div>');
    $e("body").append(template);
    lio.emit(name)
  }

  /**
   * wait for test function to evaluate to true before calling back
   */
  lio['waitFor'] = function(testFn, cb, failcb) {
    if (!lio.isFn(testFn) || !lio.isFn(cb)) {
      throw new Error("Must pass a function to test if true, as well as callback");
    }
    if (!lio.isFn(failcb)) {
      failcb = function() {
        console.log("failed")
      }
    }
    if (testFn()) {
      cb()
    } else {
      var tryCt = 0
        , waiterFnId
        , waiterFn = function() {
            tryCt++;
            if (testFn()){
              clearInterval(waiterFnId);
              cb();
            } else if (tryCt > 15) {
              clearInterval(waiterFnId);
              failcb()
            }
        };
      waiterFnId = setInterval(waiterFn, 300);
    }
  }

  /**
   * wait for a function to finish: used in the event multiple
   * functions depend on one function (data load) to finish
   */
  lio['waitForFinish'] = function(fnToWaitFor, cb, failcb) {
    if (!('hasRun' in fnToWaitFor)) {
      fnToWaitFor.hasRun = true;
      fnToWaitFor.hasFinished = false;
      fnToWaitFor(function() {
        fnToWaitFor.responseArgs = arguments;
        fnToWaitFor.hasFinished = true;
        cb.apply(context, fnToWaitFor.responseArgs);
      }, failcb);
    } else {
      lio.waitFor(function(){return fnToWaitFor.hasFinished;},
        function(){
          cb.apply(context, fnToWaitFor.responseArgs)
        }
      )
    }
  }
 
  
  var hasAuth = false
    , session = {}
    , cache = {pending:{}}
    , routeMap = {
        "get":{
          q:"apiUrl"
          , m: "rtApi"
          , user:"apiUrl"
          , meta:"apiUrl"
          , oauth:"apiUrl"
          , query:"apiUrl"
          , schema:"apiUrl"
        },
        "post":{      
          user:"apiUrl"
          , oauth:"apiUrl"
        }
      };
  
  function ammendPath(command){
    command = (command.toLowerCase().split("/")[1] in {oauth:''}) ? '/api/' + command : '/api/' + command;
    return command;
  }
  function chooseUrl(method,path){
    //lio.config.apiUrl
    var cmd0 = path.toLowerCase().split("/")[0],
      cmd1 = path.toLowerCase().split("/")[1];
    var url = routeMap[method][cmd0];
    if (url && lio.isObject(url)) {
      url = routeMap[method][cmd0][cmd1]
      return lio.config[url]
    } else if (url) {
      return lio.config[url]
    } else {
      return lio.config["apiUrl"]
    }
    //??
  }
  function isXd(){
    var h = win.location.href;
    if (h.indexOf(lio.config.apiUrl) >= 0){
      return false;
    }
    return true;
  }
  function addQsArg(url, data) {
    var arg = "";
    if (lio.isObject(data)) {
      arg = _.map(data,function(val,key){return !val ? "" : key + "=" + val.toString()}).join("&")
    } else {
      arg = data
    }
    if (url.indexOf("?") > 0 && arg != ''){
      url = url + '&' + arg;
    } else if (arg != ''){
      url = url + '?' + arg;
    }
    return url
  }


  /*
    Does current user have an authenticated session?  
    If so returns session information.  
    @return = session:  {
      authenticated: true(false)
    }
  */
  lio['getAuth'] = function(){
    return {}
  }

  function Api(o){
    this.init(o);
  };

  Api.default_config = {
    
  };
  
  Api.prototype = function(){
    var self = this;
      
    // start public prototype
    return{
      isXD:isXd(),
      init:function(config){
        this.config=o=lio.extend(config?config:{},Api.default_config);
      },
      fetch:function(args){
        
      },
      getc:function(path,data,cb,failcb){
        var key = addQsArg(path, data)

        if (key in cache){
          cb(cache[key])
          return
        }
        if (key in cache.pending){
          return cache.pending[key].push([cb,failcb])
        } else {
          cache.pending[key] = [[cb,failcb]]
          this.get(path,data,function(){},function(){},true)
        }
      },
      get:function(path,data,cb,failcb, wcache){
        var url =  chooseUrl("get",path) + ammendPath(path)
          , qs = ''
          , qss = ''
          , key = addQsArg(path, data)
          , cmds = path.toLowerCase().split("/");
        data = data || {}
        if (cmds.length > 1 && cmds[0] == "q"){
          data["meta"] = "true"
        }
        
        data.aid = lio.config.id ;
        for (field in data){
          qs = qs + qss + field + '=' + encodeURIComponent(data[field]);
          qss = '&';
        }
        url = addQsArg(url, qs)
        
        if (url.indexOf("?") > 0){
          url = this.isXD ? url + '&' : url; 
          //url = this.isXD ? url + '&callback=?' : url; 
        } else {
          //url = this.isXD ? url + '?callback=?' : url; 
          url = this.isXD ? url + '?' : url; 
        }
        
        $.ajax({
          url : url,
          dataType:'jsonp',
          success: function(data) {
            if (lio.isFn(cb)) cb(data);
            if (wcache){
              cache[key] = data
              cache.pending[key].forEach(function(d){
                d[0](data)
              })
              delete cache.pending[key]
            }
          },
          failure:function(d){
            if (lio.isFn(failcb)) failcb(d);
          },  
          statusCode: {
            404: function() {
              if (lio.isFn(failcb)) failcb({'message':'not found','code':404});
            },
            204: function() {
              if ('action' in data && data.action == 'DELETE'){
                if (lio.isFn(cb)) cb();
              }
            }
          }
        });
      },
      post:function(path,data,cb,failcb){
        data = data ? data : {};
        if (this.isXD) {
          return this.get(path,lio.extend(data,{"ACTION":"POST"}),cb,failcb);
        }
        //if (lio.isObject(data)){
        //  data = JSON.stringify(data)
        //}
        var url =  chooseUrl("post",path) + ammendPath(path), qss = '';
        url = addQsArg(url, "&aid=" + lio.config.id)
        //data.aid = lio.config.id ;
        
        $.ajax({
          url : url,
          data: data,
          method: "POST",
          type:'json',
          success: function(data) {
            if (lio.isFn(cb)) cb(data);
          },
          failure:function(d){
            if (lio.isFn(failcb)) failcb(d);
          },  
          statusCode: {
            404: function() {
              if (lio.isFn(failcb)) failcb({'message':'not found','code':404});
            },
            204: function() {
              if ('action' in data && data.action == 'DELETE'){
                if (lio.isFn(cb)) cb();
              }
            }
          }
        });
      },
      delete:function(path,data,cb,failcb){
        var url =  chooseUrl("get",path) + ammendPath(path)
          , qs = ''
          , qss = ''
          , key = addQsArg(path, data)
          , cmds = path.toLowerCase().split("/");
        data = data || {}
        if (cmds.length > 1 && cmds[0] == "q"){
          //data["meta"] = "true"
        }
        
        data.aid = lio.config.id ;
        for (field in data){
          qs = qs + qss + field + '=' + encodeURIComponent(data[field]);
          qss = '&';
        }
        url = addQsArg(url, qs)
        
        if (url.indexOf("?") > 0){
          url = this.isXD ? url + '&callback=?' : url; 
        } else {
          url = this.isXD ? url + '?callback=?' : url; 
        }
        
        $e.ajax({
          url : url,
          type:"json",
          method:'delete',
          success: function(data) {
            if (lio.isFn(cb)) cb(data);
          },
          failure:function(d){
            if (lio.isFn(failcb)) failcb(d);
          },  
          statusCode: {
            404: function() {
              if (lio.isFn(failcb)) failcb({'message':'not found','code':404});
            },
            204: function() {
              if ('action' in data && data.action == 'DELETE'){
                if (lio.isFn(cb)) cb();
              }
            }
          }
        });
      }
    }
  }();

  lio['api'] = new Api();

}(window,document));