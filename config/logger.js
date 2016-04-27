"use strict";
var winston = require('winston');
var config = require('./config');
var logger = new (winston.Logger)({
   transports: [
     new (winston.transports.Console)({	level: config.app.loggingLevel}),
     new (winston.transports.File)({ filename: config.app.logname, level: config.app.loggingLevel})
   ]
});
module.exports = logger;