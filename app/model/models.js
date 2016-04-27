"use strict";
module.exports = function (db, cb) {
	var Book = db.define('book', {
		title : String,
		author: String,
		language: String
	});
	
	var Page = db.define('page', {
		text: String,
		number: Number
	});
	
	Book.hasMany("pages", Page);
	
	return cb();
};