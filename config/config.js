"use strict";
var config = {};
config.app = {};
config.postgres = {};
config.app.port = 8081;
config.app.logname='app.log';
config.app.loggingLevel='debug';

var opts = {
	host:     'localhost',
	database: 'app',
	protocol: 'postgres',
	port:     5432,
	user: 'postgres',
	password: ''
};

var conString = "postgres://"+opts.user+":"+opts.password+"@"+opts.host+"/"+opts.database;

config.postgres.opts = opts;
config.postgres.conString = conString;

module.exports = config;