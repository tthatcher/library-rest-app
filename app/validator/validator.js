"use strict";
var pageSchema = function (isIdRequired) {
	var schema = {
		"id" : "/page",
		"type" : "object",
		"properties" : {
			"text" : {
				"text" : "string",
				required : true
			},
			"number" : {
				"number" : "integer",
				"minimum": 1,
				required : true
			},
			"id" : {
				"type" : "integer",
				required : isIdRequired
			}
		}
	};
	return schema;
};

var bookSchema = function (isIdRequired) {
	var schema = {
		"id" : "/book",
		"type" : "object",
		"properties" : {
			"title" : {
				"type" : "string",
				"required" : true
			},
			"author" : {
				"type" : "string",
				"required" : true
			},
			"language" : {
				"type" : "string",
				"required" : true
			},
			"pages" : {
				"type" : "array",
				"items" : {
					"$ref" : "/page"
				},
			},
			"id" : {
				"type" : "integer",
				required : isIdRequired
			}
		}
	};
	return schema;
};

var idSchema = {
	"id" : "/id",
	"type" : "object",
	"properties" : {
		"id" : {
			"type" : "integer",
			"required" : true
		}
	}
};

var Validator = require('jsonschema').Validator;
var validator = new Validator();
var reqIdValidator = new Validator();
validator.addSchema(pageSchema(false), '/page');
reqIdValidator.addSchema(pageSchema(true), '/page');
var exports = {};
exports.validator = {};
exports.validator.book = function (book, isIdRequired) {
	var v = isIdRequired ? reqIdValidator : validator;
	return v.validate(book, bookSchema(isIdRequired));
};

exports.validator.id = function (idObj) {
	return validator.validate(idObj, idSchema);
}

module.exports = exports;
