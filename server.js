"use strict";
var express = require('express');
var config = require('./config/config');
var logger = require('./config/logger');
var connector = require('./config/connector');
var app = express();

var bodyParser = require('body-parser');

//TODO Add Headers here
//TODO AUTH
app.use(bodyParser.json());

connector.connect(app);

app.use('/api/v1/books', require('./app/controller/books'));

var port = config.app.port;
app.listen(port, function() {
	logger.info('Server has started at port %s', port);
});
module.exports = app;