
// A simple module to replace `Backbone.sync` with *localStorage*-based
// persistence. Models are given GUIDS, and saved into a JSON object. Simple
// as that.

// Generate four random hex digits.
function S4() {
   return (((1+Math.random())*0x10000)|0).toString(16).substring(1);
};

// Generate a pseudo-GUID by concatenating random hexadecimal.
function guid() {
   return (S4()+S4()+"-"+S4()+"-"+S4()+"-"+S4()+"-"+S4()+S4()+S4());
};

// Our Store is represented by a single JS object in *localStorage*. Create it
// with a meaningful name, like the name you'd give a table.
var Store = function(name) {
  this.name = name;
  var store = localStorage.getItem(this.name);
  this.data = (store && JSON.parse(store)) || {};
};

_.extend(Store.prototype, {

  // Save the current state of the **Store** to *localStorage*.
  save: function() {
    localStorage.setItem(this.name, JSON.stringify(this.data));
  },

  // Add a model, giving it a (hopefully)-unique GUID, if it doesn't already
  // have an id of it's own.
  create: function(model) {
    if (!model.id) model.id = model.attributes.id = guid();
    this.data[model.id] = model;
    this.save();
    return model;
  },

  // Update a model by replacing its copy in `this.data`.
  update: function(model) {
    this.data[model.id] = model;
    this.save();
    return model;
  },

  // Retrieve a model from `this.data` by id.
  find: function(model) {
    return this.data[model.id];
  },

  // Return the array of all models currently in storage.
  findAll: function() {
    return _.values(this.data);
  },

  // Delete a model from `this.data`, returning it.
  destroy: function(model) {
    delete this.data[model.id];
    this.save();
    return model;
  }

});

// Override `Backbone.sync` to use delegate to the model or collection's
// *localStorage* property, which should be an instance of `Store`.
Backbone.sync = function(method, model, options) {

  var resp;
  var store = model.localStorage || model.collection.localStorage;

  switch (method) {
    case "read":    resp = model.id ? store.find(model) : store.findAll(); break;
    case "create":  resp = store.create(model);                            break;
    case "update":  resp = store.update(model);                            break;
    case "delete":  resp = store.destroy(model);                           break;
  }

  if (resp) {
    options.success(resp);
  } else {
    options.error("Record not found");
  }
};



(function(lio,win,doc){

  var templates = {}
    , app = {}
    , rtSocket = null
    , windowHeight = 0
    , windowWidth = 0
    , formatDate = d3.time.format("%B %d, %Y")
  //, TIMESPAN = '31d'

  if (windowHeight == 0){
    windowHeight = window.innerHeight
    windowWidth = window.innerWidth
  }

  // mustache to html templating meomozing templates
  var mtoHtml = function(name,data) {
    try {
      if (!(name in templates)){
        var $el = $e(name)
        if ($el){
          templates[name] = $el[0].innerHTML;
        }
      }
       if (name in templates){
         return Mustache.to_html(templates[name], data)
       }
    } catch (e) {}
    return ""
  }


  /*
   * Common Module funcs, etc
  **/
  app.ModuleView = {
    list: null,
    evt: {},
    loaded:false,
    router: function(method,id,more){
      var self = this;
      if (method in this) {
        if (!this.loaded) {
          this.evt.bind("loaded", function() {
            self[method](id,more)
          });
          //this.initialize()
        } else {
          this[method](id,more)
        }
      }
    },
    toggle:function(){
      $e(this.el).toggle();
      return this;
    },
    edit: function(id,more){
      var self = this;
      lio.waitFor(function(){return self.loaded},
        function(){
          var itemModel = self.list.get(id);
          if (itemModel) {
            //v.edit()
            itemModel.trigger("edit", [id,more]);
          }
        }
      )
     
    },
    view:function(id,more){
      var self = this,
        m = null;
      lio.waitFor(function(){
          m = self.list.get(id);
          if (m){
            return true
          }
          return false
        },
        function(){
          m.trigger("view")
        }
      )
    },
    show:function(){
      $e(this.el).show();
    },
    hide:function(){
      $e(this.el).hide();
    }
  }
  _.extend(app.ModuleView.evt, Backbone.Events);


  app.PivotView = Backbone.View.extend(lio.extend({
    el: $("#tab-pivot"),
    exfilters : false,
    isRendered:false,
    d : {},
    charts : {},
    events: { },
    initialize:function(){
      var self = this;
      if (!this.loaded){
        this.fetch()
        this.show()
        var questions = [
          {id:1,text:"How does Effect",filter:[["top stories"],["1"]]}
        ]
        var html = mtoHtml("#dimQuestionTemplate",{list:questions})
        $("#dimensionalQuestions", this.el).html(html)
        $("#dimensionalQuestions li", this.el).click(function(e){
            var id = $(e.currentTarget).attr("data-id")
            _.each(questions, function(r){
              if (r.id == id) {
                self.filter(r.filter)
              }
            })
            return false;
        });
      }
    },
    show:function(){
      $("#pivotexplorelink").tab('show');
    },
    render: function() {
      //_.each(this.charts, function(c, n){c.render()});

    },
    filter: function(filters) {
      //_.each(this.charts, function(c, n){c.render()});
      this.applyFilters(filters)
    },
    fetch: function() {
      var self = this, data;
      lio.api.getc('q/mdall', {t:TIMESPAN}, function(json){
        self.raw = json
        self.doViz(json)
      });
    },
    doViz:function(q1json){
      var self = this
        , o = {
          barWidth: "9"
          , horizontal: false
        }
      // Various formatters.
      var formatNumber = d3.format(",d")
        , formatChange = d3.format("+,d")
        , formatDate = d3.time.format("%B %d, %Y")
        , formatTime = d3.time.format("%I:%M %p");

      var vizTop = 0
        , chartsPos = $e("#tab-pivot").offset()
        , bodyPos = $e("body").offset()
        , bodyScroll = $e("body").scrollTop();

      $e(document).bind("scroll",function(e){
        //console.log("in bind scroll", e)
        //console.log($e("body").scrollTop())
        //console.log($e("#charts").offset())
      })
      // A nest operator, for grouping the flight list.
      var nestByDate = d3.nest()
          .key(function(d) { return d3.time.day(d[dateFld].date); });

      // Create the crossfilter for the relevant dimensions and groups.
      var data = lio.jsonShaper(q1json)
        , fields = data.fields()
        , dateFld = fields["_ts"]
        , ctField = fields["ct"]
        , dimall = data.__dimension(function(d) { return "" })
        , mtotviews = dimall.group().reduceSum(function(d){  return d[ctField];  })
        , dow = data.dimension("dow", function(d) { return d[fields["_d"]]; })
        , dows = dow.group().addReduceSum("ct")
        , tab = data.dimension("path", function(d) { return d[fields["path"]]; })
        , tabs  = tab.group().addReduceSum("ct")
        , share = data.dimension("share", function(d) { return d[fields["share-service"]]; })
        , shares  = share.group().addReduceSum("ct")
        , platform = data.dimension("platform", function(d) { return d[fields["platform"]]; })
        , platforms  = platform.group().addReduceSum("ct")
        , date = data.dimension("date", function(d) { return d3.time.day(d[dateFld].date); })
        , mviews = date.group().addReduceSum("ct")
        , mshares = date.group().addReduceSum("shares")
        , muserviews = date.group().addReduceSumDiv("ct", "uuct")

      var tableDef = {
          rows:100,
          columns:[
            {field: fields["_ts"], formatter:   function(d) { return formatTime(d[dateFld].date); }, class:"time"}
            , {field: fields["path"], formatter:   function(d) { return d[fields["path"]]; }, class:"feature"}
            , {field: fields["platform"], formatter:   function(d) { return d[fields["platform"]]; }, class:""}
            , {field: fields["shares"], formatter:   function(d) { return d[fields["shares"]]; }, class:""}
            , {field: fields["ct"], formatter:   function(d) { return d[fields["ct"]]; }, class:""}
          ]
        }
        , dowWords = {"0":"Sunday","1":"Monday", "2":"Tuesday", "3":"Wednesday"
              , "4":"Thursday","5":"Friday","6":"Saturday"}
      /*
        .all(function(){
          var a = tabs.ds().toa().sorta(1).slice(0,8)
          a = _.map(a,function(d,i){return {key:d[0],value:d[1]}})
          return a
        })
      */
      var charts = [

        barChart(lio.extend({horizontal:true, width:220, limit:8,numeric:false,barWidth:"15"},o))
            .dimension(tab)
            .group(tabs)
            .y(d3.scale.linear().domain([8,0]).range([200,0]))
        ,
        barChart(lio.extend({numeric:false, width:300, barWidth:"12", hoverFormat: function(d){return dowWords[d]}},o))
            .dimension(dow)
            .group(dows)
            .x(d3.scale.linear().domain([0, 7]).rangeRound([0, 240]))
        ,
        barChart(lio.extend({numeric:false,width:300,barWidth:"20"},o))
            .dimension(platform)
            .group(platforms)
            .x(d3.scale.linear().domain([0, 3]).rangeRound([0, 120 ])
          )
        ,     
        barChart(lio.extend({numeric:true,barWidth:"9"},o))
            .dimension(date)
            .group(mviews)
            .round(d3.time.day.round)
            .yaxis(d3.svg.axis().orient("right").tickFormat(d3.format(",.0f")).ticks(4))
          .x(d3.time.scale()
            .domain([new Date(2012, 4, 1), new Date(2012, 5, 1)])
            .rangeRound([0, 760]))
        ,
        barChart(lio.extend({numeric:true,barWidth:"9"},o))
            .dimension(date)
            .group(mshares)
            .round(d3.time.day.round)
            .yaxis(d3.svg.axis().orient("right").tickFormat(d3.format(",.0f")).ticks(4))
          .x(d3.time.scale()
            .domain([new Date(2012, 4, 1), new Date(2012, 5, 1)])
            .rangeRound([0, 10 * 76]))
        
      ];
      /*
      ,
        barChart(lio.extend({numeric:true,barWidth:"9"},o))
            .dimension(date)
            .group(muserviews)
            .round(d3.time.day.round)
            .yaxis(d3.svg.axis().orient("right").tickFormat(d3.format(",.0f")).ticks(4))
          .x(d3.time.scale()
            .domain([new Date(2012, 4, 1), new Date(2012, 5, 1)])
            .rangeRound([0, 10 * 76]))
      */
      // Given our array of charts, which we assume are in the same order as the
      // .chart elements in the DOM, bind the charts to the DOM and render them.
      // We also listen to the chart's brush events to update the display.
      var chart = d3.selectAll(".chart")
          .data(charts)
          .each(function(chart) { chart.on("brush", renderAll).on("brushend", renderAll); });

      // Render the initial data table
      var dataTable = d3.selectAll(".list")
          .data([tabularList]);

      // Render the total view count for this master data set
      d3.selectAll("#total")
          .text(formatNumber(mtotviews.all()[0].value));

      renderAll();

      // Renders the specified chart or list.
      function render(method) {
        d3.select(this).call(method);
      }

      // Whenever the brush moves, re-rendering everything.
      function renderAll() {
        chart.each(render);
        dataTable.each(render);
        //console.log(mtotviews.groupAll().value())
        d3.select("#active").text(formatNumber(mtotviews.all()[0].value));
        //d3.select("#active").text(formatNumber(dgall.value()));
      }

      // Like d3.time.format, but faster.
      function parseDate(d) {
        return new Date(2001,
            d.substring(0, 2) - 1,
            d.substring(2, 4),
            d.substring(4, 6),
            d.substring(6, 8));
      }
      self.applyFilters = function(filters) {
        filters.forEach(function(d, i) { charts[i].filter(d); });
        renderAll();
      };
      window.filter = self.applyFilters

      window.reset = function(i) {
        charts[i].filter(null);
        renderAll();
      };

      function tabularList(div) {
        var tableRows = nestByDate.entries(date.top(tableDef.rows));

        div.each(function() {
          d3.select(this).selectAll("div").remove()

          var date = d3.select(this).selectAll(".date")
              .data(tableRows, function(d) { return d.key; });

          date.enter().append("div")
              .attr("class", "date")
            .append("div")
              .attr("class", "day")
              .text(function(d) { return formatDate( d.values[0][dateFld].date); });

          date.exit().remove();

          var rows = date.order().selectAll(".ltablerow")
              .data(function(d) { return d.values; }, function(d) { return d.index; });

          var rowEnter = rows.enter().append("div")
              .attr("class", "ltablerow");

          tableDef.columns.forEach(function(col,i){
            rowEnter.append("div")
              .attr("class", col.class)
              .text(col.formatter);
          })

          rows.exit().remove();

          rows.order();
        });
      }

      /**
       *  barChart():   
       * options:  
       *     numeric:  is this numeric data (that can be ranged)
       *       if so, lets use a range selector "brush"
       *     horizontal:  true/false
      */
      function barChart(o) {
        if (!barChart.id) barChart.id = 0;

        var margin = {top: 10, right: 10, bottom: 20, left: 10}
          , x
          , y = d3.scale.linear().range([100, 0])
          , id = barChart.id++
          , xaxis = d3.svg.axis().orient("bottom")
          , yaxis
          , brush = d3.svg.brush()
          , brushDirty
          , dimension
          , group
          , round
          , allData
          , allDataGet
          , activefilters = []

        function barHover(d) {
          var lbl
            , e = d3.event
            , posX = e.x + parseInt(o.barWidth)
            , bodyScroll = $e("body").scrollTop()

          $e(".lbartip").remove()
          if (o.hoverFormat) {
            lbl = $e('<div class="lbartip">' + o.hoverFormat(d.key)  + ": " + d.value + '</div>')
                  .css({"top": e.y + "px","left":posX + "px"})
          } else {
            lbl = $e('<div class="lbartip">' + d.key + ": " + d.value + '</div>')
                  .css({"top": e.y + "px","left":posX + "px"})
          }
          
          $e("body").append(lbl)
        }
        function barHoverOut(d) {
          $e(".lbartip").remove()
        }
        function getAll() {
          return o.limit? group.top(o.limit) : group.all() 
        }

        function barClick(d){
          if (!this.selected) {
            this.selected = true;
            activefilters.push(d.key)
          } else {
            this.selected = false;
            activefilters = _.filter(activefilters, function(v){ return v != d.key });
          }
          chart.filter(activefilters)
          renderAll();
        }

        function chart(div) {
          var width
            , height;

          chart.div = div
          if (o.horizontal) {
            //y = d3.scale.linear().domain().range([100, 0])
            xaxis = null
            if (!x){
              x = d3.scale.linear().range([0,o.width? o.width : 240])
            }
            x.domain([0, group.top(1)[0].value]);
            width = o.width ? o.width : x.range()[1],
            height = y.range()[0];  
            
          } else {
            width = o.width ? o.width : x.range()[1],
            height = y.range()[0];
            y.domain([0, group.top(1)[0].value]);
          }
          if (yaxis) {
            margin.right = 45
          }


          div.each(function() {
            var div = d3.select(this)
                , sg
                , g = div.select("g");

            // Create the skeletal charts
            if (g.empty()) {
              div.select(".title").append("a")
                  .attr("href", "javascript:reset(" + id + ")")
                  .attr("class", "reset")
                  .text("reset")
                  .style("display", "none");

              g = div.append("svg")
                  .attr("width", width + margin.left + margin.right)
                  .attr("height", height + margin.top + margin.bottom)
                  .attr("class", "chart-" + id)
                .append("g")
                  .attr("transform", "translate(" + margin.left + "," + margin.top + ")");

              chart.g = g

              g.append("clipPath")
                  .attr("id", "clip-" + id)
                .append("rect")
                  .attr("width", width)
                  .attr("height", height);

              if (o.numeric) {
                // create 2 equal elements (uses paths within element to be the bar)
                // foreground/background for greyed out/not
                g.selectAll(".bar")
                    .data(["background", "foreground"])
                  .enter().append("path")
                    .attr("class", function(d) { return d + " bar"; })
                    .datum( getAll() ) 
                    
              } else {

                if (o.horizontal) {
                  g.selectAll(".bar")
                        .data(getAll())
                      .enter().append("svg:rect")
                        .attr("x", function(d, i) { return 0; })
                        .attr("y", function(d,i) { return y(i); })
                        .attr("width", function(d) { return x(d.value); })
                        .attr("height", o.barWidth)
                        .attr("class", "bar selected")
                        .on("click", barClick)
                        .on("mouseover", barHover)
                        .on("mouseout",barHoverOut)

                  g.selectAll("text")
                        .data(getAll())
                      .enter()
                        .append("text")
                          .attr("class", "hblabel")
                          .attr("x", function(d, i) { return 5; })
                          .attr("y", function(d,i) { return y(i) + 12; })
                          .attr("text-anchor", "start") // text-align: left
                          .attr("width", "200")
                          .attr("height","20")
                          .text(function(d) { return d.key; })
                          .on("click",barClick)

                    /*g.selectAll(".bar")
                      .enter().append("text")
                        .attr("x", function(d, i) { return 10; })
                        .attr("y", function(d,i) { return y(i); })
                        .attr("text-anchor", "start") // text-align: left
                        .text(function(d) { return d.key; })
                    */
                } else {
                  g.selectAll(".bar")
                      .data(getAll())
                    .enter().append("svg:rect")
                      .attr("x", function(d, i) { return x(i); })
                      .attr("y", function(d) { return y(d.value); })
                      .attr("height", function(d) { return height - y(d.value); })
                      .attr("width", o.barWidth)
                      .attr("class", "bar selected")
                      .on("click", barClick)
                      .on("mouseover", barHover)
                      .on("mouseout",barHoverOut)
                }
              }


              g.selectAll(".foreground.bar")
                  .attr("clip-path", "url(#clip-" + id + ")");

              if (yaxis) {
                yaxis.scale(y);
                g.append("g")
                    .attr("class", "yaxis")
                    .attr("transform", "translate(" + width + ",0)")
                    .call(yaxis);
              } 
              if (xaxis) {
                xaxis.scale(x);
                g.append("g")
                    .attr("class", "xaxis")
                    .attr("transform", "translate(0," + height + ")")
                    .call(xaxis);
              }
              
              if (o.numeric){
                // Initialize the brush component with pretty resize handles.
                var gBrush = g.append("g").attr("class", "brush").call(brush);
                gBrush.selectAll("rect").attr("height", height);
                gBrush.selectAll(".resize").append("path").attr("d", resizePath);
              }
            } else {
              // not empty
              if (allDataGet) {
                g.selectAll(".bar")
                        .data(allDataGet())
              }
              if (!o.numeric && !brushDirty) {
                if (o.horizontal) {
                  div.selectAll(".bar")
                    .attr("width", function(d, i) { return x(d.value); })
                } else {
                  div.selectAll(".bar")
                    .attr("y", function(d, i) { return y(d.value); })
                    .attr("height", function(d, i) { return height - y(d.value); })
                }  
              }

              // Only redraw the brush if set externally.
              if (o.numeric && brushDirty){
                
                g.selectAll(".brush").call(brush);
                div.select(".title a").style("display", brush.empty() ? "none" : null);
                if (brush.empty()) {
                  g.selectAll("#clip-" + id + " rect")
                      .attr("x", 0)
                      .attr("width", width);
                } else {
                  var extent = brush.extent();
                  g.selectAll("#clip-" + id + " rect")
                      .attr("x", x(extent[0]))
                      .attr("width", x(extent[1]) - x(extent[0]));
                }
              } 

              if (yaxis) {
                yaxis.scale(y);
                g.select(".yaxis").call(yaxis);
              } 
              if (xaxis) {
                xaxis.scale(x);
                g.select(".xaxis").call(xaxis);
              }
            }
            
            if (o.numeric) {
              // redraw all bars
              div.selectAll(".bar").attr("d", barPath);
            }

            brushDirty = false;
          });
          

          // build the actual bars
          function barPath(groups) {
            var path = [],
                i = -1,
                n = groups.length,
                d;
            while (++i < n) {
              d = groups[i];
              path.push("M", x(d.key), ",", height, "V", y(d.value), "h" + o.barWidth + "V", height);
            }
            return path.join("");
          }

          // the "handle"
          function resizePath(d) {
            var e = +(d == "e"),
                x = e ? 1 : -1,
                y = height / 3;
            //return "M10.129,22.186 16.316,15.999 10.129,9.812 13.665,6.276 23.389,15.999 13.665,25.725z"
            return "M" + (.5 * x) + "," + y
                + "A6,6 0 0 " + e + " " + (6.5 * x) + "," + (y + 6)
                + "V" + (2 * y - 6)
                + "A6,6 0 0 " + e + " " + (.5 * x) + "," + (2 * y)
                + "Z"
                + "M" + (2.5 * x) + "," + (y + 8)
                + "V" + (2 * y - 8)
                + "M" + (4.5 * x) + "," + (y + 8)
                + "V" + (2 * y - 8);
          }
        }

        brush.on("brushstart.chart", function() {
          var div = d3.select(this.parentNode.parentNode.parentNode);
          div.select(".title a").style("display", null);
        });

        brush.on("brush.chart", function() {
          var g = d3.select(this.parentNode),
              extent = brush.extent();
          if (round) g.select(".brush")
              .call(brush.extent(extent = extent.map(round)))
            .selectAll(".resize")
              .style("display", null);
          g.select("#clip-" + id + " rect")
              .attr("x", x(extent[0]))
              .attr("width", x(extent[1]) - x(extent[0]));
          dimension.filterRange(extent);
        });

        brush.on("brushend.chart", function() {
          if (brush.empty()) {
            var div = d3.select(this.parentNode.parentNode.parentNode);
            div.select(".title a").style("display", "none");
            div.select("#clip-" + id + " rect").attr("x", null).attr("width", "100%");
            dimension.filterAll();
          }
        });

        chart.margin = function(_) {
          if (!arguments.length) return margin;
          margin = _;
          return chart;
        };

        chart.xaxis = function(_) {
          if (!arguments.length) return xaxis;
          xaxis = _;
          return chart;
        };
        chart.yaxis = function(_) {
          if (!arguments.length) return yaxis;
          yaxis = _;
          return chart;
        };
        chart.x = function(_) {
          if (!arguments.length) return x;
          x = _;
          brush.x(x);
          return chart;
        };

        chart.y = function(_) {
          if (!arguments.length) return y;
          y = _;
          return chart;
        };

        chart.dimension = function(_) {
          if (!arguments.length) return dimension;
          dimension = _;
          return chart;
        };

        chart.filter = function(args) {
          if (o.numeric) {
            if (args) {
                brush.extent(args);
                dimension.filterRange(args);
            } else {
              brush.clear();
              dimension.filterAll();
            }
          } else {
              var keys = {}
              if (!args) {
                activefilters = []
              }
              dimension.filter(null);
              
              if (args && args.length > 0){
                chart.div.select(".title a").style("display", null);
                dimension.filter.apply( dimension , args)
                _.each(args,function(r){ keys[r] = true })
                chart.g.selectAll(".bar")
                  .attr("class",function(d){
                    if (keys[d.key]) {
                      this.selected = true
                      return "bar selected"
                    }
                    this.selected = false
                    return "bar"
                  })
              } else {
                chart.div.select(".title a").style("display","none");
                chart.g.selectAll(".bar")
                  .attr("class",function(d){
                    this.selected = false
                    return "bar selected"
                  })
              }
              
          } 
          brushDirty = false;
          return chart;
        };

        chart.all = function(_) {
          if (!arguments.length) allDataGet
          allDataGet = _;
          return chart;
        }
        chart.group = function(_) {
          if (!arguments.length) return group;
          group = _;
          return chart;
        };

        chart.round = function(_) {
          if (!arguments.length) return round;
          round = _;
          return chart;
        };

        return d3.rebind(chart, brush, "on");
      }
    },
    update: function(){

    },
    view: function(id){
      var self = this;
      if (id != undefined) {
        //self.dim.filter(id)
      }
      self.update()
    }
  },app.ModuleView));


  app.DashboardView = Backbone.View.extend(lio.extend({
    el: $("#tab-dashboard"),
    exfilters : false,
    isRendered:false,
    d : {},
    charts : {
      views : new lio.MorrisChart({title:"Views",h:150, target:"#exploreViews"
          , ykeys:['1'], labels:["Views: "], xkey:"t", parseTime: true, xLabels: "day"
          , dateFormat: function(x) {return formatDate(new Date(x)); }
        })
      , newu : new lio.MorrisChart({title:"New Users",h:150, target:"#exporeNewUsers"
          , ykeys:['1'], labels:["New Users: "], xkey:"t", parseTime: true, xLabels: "day"
          , dateFormat: function(x) {return formatDate(new Date(x)); }
        })
      , shares : new lio.MorrisChart({title:"Shares",h:150, target:"#exploreShares"
          , ykeys:['1'], labels:["Shares: "], xkey:"t", parseTime:true,  xLabels: "day"
          , dateFormat: function(x) {return formatDate(new Date(x)); }
        })
      , users : new lio.MorrisChart({title:"Users",h:150, target:"#exploreUsers"
          , ykeys:['1'], labels:["Users: "], xkey:"t", parseTime:true,  xLabels: "day"
          , dateFormat: function(x) {return formatDate(new Date(x)); }
        })
      , userviews : new lio.MorrisChart({title:"Views/User",h:150, target:"#exploreViewsPerUser"
          , ykeys:['1'], labels:["Views: "], xkey:"t", parseTime:true,  xLabels: "day"
          , dateFormat: function(x) {return formatDate(new Date(x)); }
        })
      , sharehist : new lio.BarGraph2({target:"#dashShareHist", h: 150
        , title:"Shares by Previous Shares"
        , style:function(){return "width:" + ((windowWidth / 3) -50) + "px;word-wrap: break-word;"}
      })
      , visithist : new lio.BarGraph2({target:"#dashVisitHist", h: 150
        , title:"Visits by Previous Visit Ct"
        , style:function(){return "width:" + ((windowWidth / 3) -50) + "px;word-wrap: break-word;"}
      })
    },
    events: {
      "click    .jsfilter input"           : "applyFilterCB",
      "click    .jsAllFilters"           : "allfilters"
    },
    initialize:function(){
      if (!this.loaded){
        $("#dashboardtablink").tab('show');
        this.fetch();
      }
    },
    allfilters:function(e){
      if (this.exfilters){
        this.exfilters = false
        $("#exploreExtraFilters").css("visibility","hidden")
      } else {
        $("#exploreExtraFilters").css("visibility","visible")
        this.exfilters = true
      }
      return false
    },
    setupFilters:function(){
      var self = this
      _.each(self.d,function(d,name){
        if (!lio.isArray(d.activefilters)){
          self.d[name].activefilters = []
        }
      })
          },
    applyFilterBG:function(name, val, chkd){
      this.applyFilter(name,val,chkd)
    },
    applyFilter:function(name, val, chkd){
      var self = this
      if (self.d[name].activefilters.length > 0){
        self.d[name].filter()
      }
      if (chkd) {
        if (name in self.d) {
          self.d[name].activefilters.push(val)
          //self.d[name].filter(val)
        }
      } else {
        self.d[name].activefilters = _.filter(self.d[name].activefilters, function(v){ return v != val });
      }
      console.log(name, self.d[name].activefilters)
      if (self.d[name].activefilters.length == 0){
        self.d[name].filter()
      } else {
        self.d[name].filter.apply(self.d[name], self.d[name].activefilters)
      }
      self.update()
      //data.total.filter([0, 100], 190, [200, 300]);
    },
    applyFilterCB:function(e){
      var self = this, name, val, chkd
        , $el = $(e.currentTarget)
      if ($el) {
        val = $el.attr("value")
        name = $el.attr("name")
        chkd = $el.is(':checked')
        $el.parent().parent().parent().find("input").attr("checked", false)
        if (chkd) {
          $el.attr('checked',true)
        }
        self.applyFilter(name,val, chkd)
      }
    },
    show:function(){
      $("#dashboardtablink").tab('show');
    },
    render: function() {
      //_.each(this.charts, function(c, n){c.render()});
    },
    fetch: function() {
      var self = this, data, fields;
      lio.api.getc('q/summary', {t:TIMESPAN}, function(json){
        data  = lio.jsonShaper(json)
        //self.data = data
        fields = data.fields()
        self.d.date = data.dimension("period", function(d) { return d[fields["_ts"]].ts * 1000; })
        self.d.views = self.d.date.group().addReduceSum("ct")
        self.d.shares = self.d.date.group().addReduceSum("shares")
        self.d.users = self.d.date.group().addReduceSum("uuct")
        self.d.newu = self.d.date.group().addReduceSum("newu")
       

        self.loaded = true
        self.evt.trigger("loaded")
        if (!self.isRendered){
          self.isRendered = true;
          self.render();
        }
  
        self.update()
        self.setupFilters()
      });
      lio.api.getc('q/sharing', {t:TIMESPAN}, function(json){
          if (json.data && json.data.length > 0){
            var ds = lio.jsonShaper(json)
              , flds = ds.fields()
              , shares = [0,0,0,0]
              , visits = [0,0,0,0]
              , sharef = flds["preshares"]
              , visitf = flds["visitct"]
              , shareh
              , visith
              , tohlabel = function(l) {
                  l.push(l[l.length - 1] + " and up")
                  for (var i = l.length - 2; i >= 1; i--) {
                    l[i] = l[i - 1] + " to " + l[i]
                  };
                  l[0] = "0" 
                  return l
              }
            json.meta.measures.forEach(function(r,i){
              if (r.Id == "preshares"){
                shareh = tohlabel(r.Args.split(","))
              }
              if (r.Id == "preshares"){
                visith = tohlabel(r.Args.split(","))
              }
            })
            json.data.forEach(function(p,pi){
              p.rows.forEach(function(r,i){
                if (r && r[sharef] && r[sharef].length) {
                  r[sharef].forEach(function(d,y){
                    shares[y] += d
                  })
                }
                if (r && r[visitf] && r[visitf].length) {
                  r[visitf].forEach(function(d,y){
                    visits[y] += d
                  })
                }
              })
            })

            shares = _.map(shares,function(r,i){
              return [shareh[i], r]
            })
            visits = _.map(visits,function(r,i){
              return [visith[i], r]
            })
            console.log(shares)
            console.log(visits)
            self.charts.sharehist.prepare(function(){
              return shares
            }).render()
            self.charts.visithist.prepare(function(){
              return visits
            }).render()
          }
      });

    },
    update: function(){
      var self = this, views, shares, users, newusers, userviews;
      views = self.d.views.ds().too1().out()  
      shares = self.d.shares.ds().too1().out()  
      users = self.d.users.ds().too1().out()  
      newusers = self.d.newu.ds().too1().out()
      userviews = lio.odiv(views, users)
      //console.log(shares)
      //console.log(views)
      console.log(newusers)
      self.charts.shares.prepare(function(){
        return shares;
      }).render()
      self.charts.views.prepare(function(){
        return views;
      }).render()
      self.charts.users.prepare(function(){
        return users;
      }).render()
      self.charts.newu.prepare(function(){
        return newusers;
      }).render()
      self.charts.userviews.prepare(function(){
        return userviews;
      }).render()
    },
    view: function(id){
      var self = this;
      if (id != undefined) {
        self.author.filter(id)
      }
      self.update()
    }
  },app.ModuleView));


  /*  
  Viz Manager
  */
  app.AppVizView = Backbone.View.extend( {
    modules : {
      authors: new app.AuthorsManagerView()
      , pivot: function() {return new app.PivotView()} 
      , dashboard: function() {return new app.DashboardView()}
      , users: function() {return new app.UserView()}
      , articles: function() {return new app.ArticleView()}
    },
    actions : {
      tag: null
    },
    events: {
      "click    .jsexpfilter"           : "exploreFilters",
    },
    curModule: null,
    // on creation, load up code mirror js
    initialize:function(){
    },
    render: function() {
      return this;
    },
    exploreFilters: function(e) {
      $("#appViz .appPanel").hide();
      return false
    },
    changePanels: function(e) {
      $("#appViz .appPanel").hide();
    },
    routeToModule: function(module,method,id,more){
      if (!method) method = "show"
      if (module in this.modules){
        if (lio.isFn(this.modules[module])){
          this.modules[module] = this.modules[module]()
        }
        if (this.curModule != module) {
          this.changePanels();
          this.modules[module].show();
        }
        this.curModule = module;
        this.modules[module].router(method,id,more)
      } else if (module in this.actions){
        this["show"+module]()
      }
    }
  });
  var appViz = new app.AppVizView({ el: $("#appViz") });

  // start app router (backbone.js)
  var AppRouter = Backbone.Router.extend({
        routes: {
            "": "home",
            "dashboard": "home",
            ":module": "lazyRouter",
            ":module/:method": "lazyRouter",
            ":module/:method/:id": "lazyRouter",
            ":module/:method/:id/:more": "lazyRouter",
        },
        home : function(){
          //$("#dashboardtablink").tab('show');
          appViz.routeToModule("dashboard","show");
        },
        lazyRouter : function(module, method, id, more){
          appViz.routeToModule(module,method,id,more);
          console.log(arguments);
        }
    });

  $e.domReady(function () {
    setTimeout(function(){
      app.router = new AppRouter;
      Backbone.history.start();
    }, 500);
    
  })




}(lio,window,document))