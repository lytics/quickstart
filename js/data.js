/**
 * liodata
 * Depends on underscore.js
 * 
 */  
(function(doc,win,context){

  var as = Array.prototype.slice
    , otostr = Object.prototype.toString
    , dayOfWeek =  {"0":"Sun", "1":"Mon", "2":"Tue","3":"Wed","4":"Thur","5":"Fri","6":"Sat"}
    
context = context ? context : win;

function isFn(it){return otostr.call(it) === "[object Function]"}
function isObject(it){return otostr.call(it) === "[object Object]"}
function isString(it){return otostr.call(it) === "[object String]"}
function isArray(it){return otostr.call(it) === "[object Array]"}

/**
 * the classic extend
 * @param target
 * @param source
 * @param overwrite (bool, optional) to overwrite
 *   target with source properties default = false.
 * @returns target
*/
function extend(target, source,overwrite){
  if (!source) return target;
  for (p in source){
    if (source.hasOwnProperty(p) && (!(p in target) || overwrite)){
      target[p] = source[p]
    }
  }
  return target;
}

/**
 * jsonWrapper, creates a crossfilter from a Lytics Json Object
 * o = options:  
 *   if string:  field to grab
 *   if array:  list of fields to explode (from distinct object, to part of array)
*/
function jsonShaper(json, o, keep){
  var ts = null
    , ds = []
    , rd 
    , tot = 0
    , group 
    , row = {}
    , newv
    , meta = {}
    , fieldCt = 1
    , fieldi = 0
    , fields = {}
    , dim;

  if (json && json.meta && json.meta.measures) {
    meta = json.meta
    if (meta.dimensions && meta.dimensions.length > 0) {
      meta.dimensions.forEach(function(d,i){
        fields[d] = i
      })
      fieldCt = meta.dimensions.length 
    } else {
      fields["_"] = 0
    }
    meta.measures.forEach(function(r,i){
      r.i = i
      fields[r.As] = fieldCt //i + fieldCt
      fieldCt ++
    })
    fields["_ts"] = fieldCt // + meta.measures.length
    fieldCt ++
  }


  if (isString(o)){
    o = {field:fields[o]}
  } else if (isArray(o)){
    o = {explode:o,keys:{},expi:[]}
    o.explode.forEach(function(key,i){
      fields[key + "_tot"] = fieldCt 
      fieldCt ++
    })
  } else if (arguments.length == 1) {
    o = {}
  }

  // else if object, keep going
  if (arguments.length >= 3 && !o.hasOwnProperty("keep")) o.keep = keep

  function addrow(row, newv){
    if (o.hasOwnProperty("keep")){
      o.keep.forEach(function(fld,ri){
        if (row.hasOwnProperty(fld)){
          newv[fld] = row[fld]
        }
      })
    }
    ds.push(newv)
  }
  function flattenObj(newv, ts){
    if (isArray(newv)){
      newv.forEach(function(r,ri){
        for (p in r){
          ds.push({"_ts":ts,"value":r[p],"key":p})
        }
      })
    }
  }
  function shape() {

  }
  if (json && json.data && json.data.length) {
    json.data.forEach(function(d,i){
      ts = d["_ts"]
      ts.date = new Date(ts.ts * 1000)
      if ('rows' in d) {
        if (o.hasOwnProperty("field")){
          d.rows.forEach(function(r,ri){
            if (o.field < r.length){
              newv = r[o.field]
              if (isArray(newv)){
                newv.forEach(function(r2,ri){
                  for (p in r2){
                    addrow(r, {"_ts":ts,"value":r2[p],"key":p})
                  }
                })
              } else if (isObject(newv)){
                _.each(newv, function(v,n){
                    addrow(r, {"_ts":ts,"value":v,"key":n})
                })
              } else {
                row = {}
                row[o.field] = r[o.field]
                row["_ts"] = ts
                addrow(r, row)
              }
            }
          })
        } else if (o.explode) {
          d.rows.forEach(function(r,ri){
            r.push(ts)
            o.explode.forEach(function(fk, fki){
              rd = r[fields[fk]]
              if (rd) {
                tot = 0
                for (p in rd) {
                  if (!(p in o.keys)) {
                    o.keys[p] = p 
                    fields[p] = fieldCt 
                    fieldCt ++
                  }
                  tot += rd[p]
                  //fieldi = fields[p]
                  r[fields[p]] = rd[p]
                }
                r[fields[fk+"_tot"]] = tot
              }
            }) 
            ds.push(r)
          })
        } else {
          d.rows.forEach(function(r,ri){
            r.push(ts)
            ds.push(r)
          })
        }
      } else {
        if (o.field && o.field in d){
           flattenObj(d[o.field], ts)
        } else {
          d.push(ts)
          ds.push(d)
        }
      }
    })
  }
  //console.log(ds)
  return cfHelper(ds,o.field, fields)
}
context['jsonShaper'] = jsonShaper

var shaperId = 0
  , cfhelperId = 0
  , jsonShaperId = 0;

function cfHelper(ds, name, fields){

  var cf, shaper;
  cf = crossfilter(ds)
  cf.idx = cfhelperId
  cfhelperId += 1

  //console.log("creating cfhelper for " + cf.idx + " name= " + name)

  function dimension2(dname, fn) {
    var dim;

    if (arguments.length == 2) {
      dim = cf.__dimension(fn)
    } else if (arguments.length == 1 && isFn(dname)) {
      dim = cf.__dimension(dname)
    } else {
      dim = cf.__dimension()
    }

    function group2(){
      var ds
        , group = dim.__group()
      if (!group.hasOwnProperty("addReduceSum")) {
        // replace original group
        group = extend(group,{
          ds: function() {
            if (!group.hasOwnProperty("_ds")){
              //console.log("creating shaper for " + cf.idx + " name= " + name)
              group._ds = dataShaper(group, undefined, fields)
            }
            return group._ds
          },
          addReduceSumDiv : function(field,field2) {
            var fldPos = fields[field]
              , fldPos2 = fields[field2]
            group.reduceSum(function(d) {
              return d[fldPos2] > 0 ? d[fldPos] / d[fldPos2] : 0;
            })
            return group
          }
        , addReduceSum : function(field) {
            var fldPos = fields[field], fv
            group.reduceSum(function(d) {
              return d[fldPos] ? d[fldPos] : 0;
            })
            return group
          }
        , addReduceDSum : function(field) {
            fieldPosition = fields[field]
            var d;
            group.reduce(
              function reduceAdd(dmap, v) {
                d = v[fieldPosition]
                for (p in d){
                  if (!(p in dmap)){
                    dmap[p] = d[p]
                  } else {
                    dmap[p] += d[p]
                  }
                }
                return dmap;
              },
              function reduceRemove(dmap, v) {
                d = v[fieldPosition]
                for (p in d){
                  if (!(p in dmap)){
                    //dmap[p] = d[p]
                  } else {
                    dmap[p] -= d[p]
                  }
                }
                return dmap;
              },
              function reduceInitial() {
                return {};
              }
            )
            //all = group.all()
            /*d = {}
            all.forEach(function(d){
              _.each(d.value, function(val,key){
                if (!(key in d)){
                  d[key] = val
                } else {
                  d[key] += val
                }
              })
            })
            */
            return group
          }
        , addReduceAvg : function(field) {
            var fldPos = fields[field]
            group.reduce(
              function reduceAdd(p, v) {
                p.ct ++
                p.t += v[fldPos]
                return p;
              },
              function reduceRemove(p, v) {
                p.ct --
                p.t -= v[fldPos]
                return p;
              },
              function reduceInitial() {
                return {ct:0,t:0};
              }
            )
            all = group.all()
            all.forEach(function(d){
              d.value = d.value.t / d.value.ct
            })
            return group
          }
        , g: function() {
            return dim.__group()
          }
        })
      }
      return group
    }

    //console.log("dim =" + dname + " cfname = " + name)
    if (!dim.hasOwnProperty("__group")) {
      // replace original group
      dim.__group = dim.group
      dim.group = group2
    }
    return dim
  }

  //console.log(!cf.hasOwnProperty("__dimension"))
  if (!cf.hasOwnProperty("__dimension")) {
    // replace original dimension
    cf.__dimension = cf.dimension
    cf.dimension = dimension2
    cf.data = function(){
      if (!shaper) shaper = dataShaper(null, ds, fields)
      return shaper
    }
    cf.g = function() {
      if (!cf.hasOwnProperty("_g")){
        cf._g = true
        return cf.dimension("anon", function(d) { return d["key"]; }).group()
      }
      return cf.dimension().group()
    }
  }

  cf.fieldPosition = function(field){
    return fields[field]
  }
  cf.fields = function(){
    return fields
  }
  return cf
}

context['cfHelper'] = cfHelper

context["odiv"] = function(a,b) {
  var c = []
  _.each(a,function(row,i){
    //{x:i.toString(), "1": d.value, "t":d.key}
    c[i] = {x:row.x, t:row.t, "1": row["1"]/ b[i]["1"]}
  })
  return c
}

function dataShaper(group,raw, fields){
  var data = raw, all;
  if (!group){
    group = {all:function(){return raw;}}
  }
  function shaper() {
  }
  shaper.id = shaperId
  shaperId += 1
  shaper.all = function() {
    data = group.all()
    return shaper
  };
  shaper.in = function(d) {
    data = d
    return shaper
  };
  // the end of a chaining series, return the data not the object
  shaper.out = function() {
    return data;
  };
  // pick specific columns
  shaper.pickFields = function(fld, def){
    var out = [], val, field = fields[fld];
    all = group.all()
    all.forEach(function(d){
      if (!d.hasOwnProperty("length")){
        val = d[fld];
        if (isObject(val)){
          console.log("not implemented")
          out.push(val);
        } else {
          out.push(val);
        }
      } else if (d.length > field){
        val = d[field];
        if (isObject(val)){
          console.log("not implemented")
          out.push(val);
        } else {
          out.push(val);
        }
        
      } else if (def !== undefined) {
        out.push(def);
      }
    })
    data = out
    return shaper
  };
  // Sort Array by given column position
  shaper.sorta = function(f) {
    data = _.sortBy(data,function(d){return - d[f]})
    return shaper
  };
  // To array
  shaper.toa = function() {
    var out = [];
    all = group.all()
    all.forEach(function(d){
      out.push([d.key, d.value]);
    })
    data = out
    return shaper
  };
  shaper.notoa = function() {
    var out = [];
    all = group.all()
    _.each(all, function(val,key){
      out.push([key, val]);
    })
    data = out
    return shaper
  };
  // Flatten an object (something created with "Distinct") into 
  // single flat object and list of keys
  shaper.fo = function() {
    var out = {keys:[],rows:[]}
      , keys = {}
      , row = {}
    all = group.all()
    all.forEach(function(d){
      row = {key:d.key}
      _.each(d.value, function(val,key){
        if (!(key in keys)) keys[key] = key
        row[key] = val
      })
      out.rows.push(row)
    })
    out.keys = _.keys(keys);
    data = out
    return shaper
  };
  // Object To Array   with array [key,value] format
  shaper.otoa = function() {
    var out = [];
    all = group.all()
    all.forEach(function(d){
      _.each(d.value, function(val,key){
        out.push([key, val]);
      })
    })
    data = out
    return shaper
  };
  shaper.too1 = function() {
    var out = [];
    all = group.all()
    all.forEach(function(d,i){
      out.push({x:i.toString(), "1": d.value, "t":d.key});
    })
    data = out
    return shaper
  };
  // Array To Object
  shaper.atoo = function() {
    var out = [], row;
    data.forEach(function(d, xct){
      if (isArray(d)){
        row = {"x":xct.toString()}
        d.forEach(function(v,i){
          row[i.toString()] = v
        })
      } else {
        row = {"x":xct.toString(), "1":d}
      }
      out.push(row);
    })
    data = out
    return shaper
  };
  shaper.too = function() {
    // ["topurl",0]
    var out = [], row, fld, fi, def, flds = [], ts = fields["_ts"];
    if (arguments.length > 0) {
      flds = []
      for (var i = 0; i < arguments.length; i++) {
        fld = arguments[i]
        fi = fields[fld[0]]
        def = fld[1]
        flds.push([fi, def])
      };
    }
    
    all = group.all()
    all.forEach(function(d, xct){
      row = {"x":xct} 
      if (d.length > ts) row["t"] = d[ts].ts * 1000
      flds.forEach(function(fld,fct){
        if (d.length > fld[0]){
          row[(fct + 1).toString()] = d[fld[0]]
        } else {
          row[(fct + 1).toString()] = d[fld[1]]
        }
      })
      out.push(row);
    })
    data = out
    return shaper
  };
  // Cross Filter to Object
  shaper.cftoo = function() {
    var out = [], row, flds = [["value",0]];
    if (arguments.length > 0) {
      flds = []
      for (var i = 0; i < arguments.length; i++) {
        flds.push(arguments[i])
      };
    }
    all = group.all()
    all.forEach(function(d, xct){
      if (isArray(d)){
        row = {"x":xct}  //, "t":d["_ts"].ts
        if ("_ts" in d) row["t"] = d["_ts"].ts * 1000
        d.forEach(function(v,i){
          row[i.toString()] = v
        })
      } else {
        row = {"x":xct} //, "t":d["_ts"].ts
        if ("_ts" in d) row["t"] = d["_ts"].ts * 1000
        flds.forEach(function(fld,fct){
          if (fld[0] in d){
            row[(fct + 1).toString()] = d[fld[0]]
          } else {
            row[(fct + 1).toString()] = d[fld[1]]
          }
        })
      }
      out.push(row);
    })
    data = out
    return shaper
  };
  // Pick a speciic column
  shaper.pickCol = function(col) {
    var out = [];
    data.forEach(function(d){
      out.push(d[col]);
    })
    data = out
    return shaper
  };
  shaper.slice = function(s,ct) {
    if (isArray(data) && data.length > ct) {
      return data.slice(s,ct)
    } else {
      return data
    }
  };
  /* create a new field, by summing a distinct/top object list
   */
  shaper.addSumO = function(field,newfield){
    var val, sm;
    all = group.all()
    all.forEach(function(d){
      if (d.hasOwnProperty(field)){
        val = d[field];
        if (isObject(val)){
          sm = 0
          for (p in val){
            sm += val[p]
          }
          d[newfield] = sm
        }
      }
    })
    return shaper
  };
  return shaper
}
context['dataShaper'] = dataShaper

})(document,window);