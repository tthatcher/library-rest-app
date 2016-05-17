"use strict";
module.exports = function (db, callback) {
	var Book = db.define('book', {
			title : String,
			author : String,
			language : String
		}, {
			cache : false
		});

	var Page = db.define('page', {
			text : String,
			number : Number
		}, {
			cache : false
		});

	Book.hasMany("pages", Page);

	callback();
};
