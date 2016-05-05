"use strict";

var success = function () {
	return {
		success : "success"
	};
}

var error = function () {
	return {
		error : "There was a problem processing your request"
	};
}

var exports = {};

exports.messages = {};

exports.messages.success = success;

exports.messages.error = error;

module.exports = exports;
