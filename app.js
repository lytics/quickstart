var express = require('express')
  , util = require('util')
  , fs = require('fs')
  , ejs = require('ejs')

// global app
app = express.createServer(
    express.logger()
    , express.bodyParser()
  )

/* 
Setup the express web app config/settings:
  - views, templating, directories 
*/
//app.use(express.static(__dirname + '/'));
app.configure(function(){
  app.use(express.static(__dirname + '/bootstrap'));
  app.use(express.static(__dirname + '/css'));
  app.use(express.static(__dirname + '/images'));
  app.use(express.static(__dirname + '/js'));
  app.use(express.static(__dirname + '/'));
  app.set('views', __dirname + '/views');
  app.register('html', require('ejs'));
  app.set('view engine', 'html');
  app.enable("jsonp callback");
  app.use(express.cookieParser());
});
// set default layout, combined with above register "html" causes layout.html to be view
//app.locals.layout = 'layout';

app.get('/', function(req, res){
  res.render('index',{layout:false});
});

app.listen(8022);