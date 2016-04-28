"use strict";
var express = require('express');
var router = express.Router();
var async = require('async');
var logger = require('../../config/logger');
var v = require('../validator/validator').validator;

router.get('/', function(req, res) {
	//TODO Should return pages
	req.models.book.find({}, function(err, books) { 
		if(err) {
			logger.info('There was an error with this request ', error);
			res.status(500).json({error:"There was a problem processing your request"});
		} else {
			logger.debug('Returning books', books);
			res.status(200).json(books);
		}
	});
});

router.put('/', function(req, res) {
	var parsedBody = req.body;
	
	async.waterfall([
		function(callback) {
			callback(validateBodyMatchesBookSchema(res, parsedBody));
		},
		function(callback) {
			req.models.book.create({title: parsedBody.title, author: parsedBody.author, language: parsedBody.language}, function(err, book) {
				if(!err) logger.debug("Book with id %s has been added", book.id);
				callback(err, book);
			});
		},
		function(book, callback) { 
			if(parsedBody.pages) {
				req.models.page.create(parsedBody.pages, function(err, pages) {
					if(!err) pages.forEach(x => logger.debug('Page with id %s has been added', x.id));
					callback(err, book, pages);
				});
			} else {
				callback(null, book, null);
			}
			
		},
		function(book, pages, callback) {
			book.setPages(pages, function(err) {
				logger.debug('Pages have been set');
				callback(err);
			});
		}
	], function(err){
		determineSuccess(err, res);
	});
});

router.post('/', function(req, res) {
	var parsedBody = req.body;
		
	async.waterfall([
		function(callback) {
			callback(validateBodyMatchesBookSchema(res, parsedBody, true));
		},
		function(callback) {
			req.models.book.get(parsedBody.id, function(err, Book) {
				Book.title = parsedBody.title;
				Book.author = parsedBody.author;
				Book.language = parsedBody.language;
				logger.debug("Book with id %s has been changed", Book.id);
				callback(err, Book);
			});
		},
		function(Book, callback) { 
			Book.save(function(err) {
				callback(err);
			});
		},
		function(callback) {
			if(parsedBody.pages) {
				async.each(parsedBody.pages, updatePage, function(err) {
					callback(err);
				});
			} else {
				callback(null);
			}
		}
	], function(err){
		determineSuccess(err, res);
	});
	
	
});

router.delete('/', function(req, res) {
	var parsedBody = req.body;
	
	async.waterfall([
		function(callback) {
			callback(validateBodyMatchesIdSchema(res, parsedBody));
		},
		function(callback) {
			req.models.book.find(parsedBody.id).remove(function(err) {
				if(!err) logger.info('Book with id ' + parsedBody.id + ' was removed');
				callback(err);
			});
		}
	], function(err){
		determineSuccess(err, res);
	});
});

function updatePage(page, callback) {
	req.models.page.get(page.id, function(err, Page) {
		if(err) {
			callback(err, Page);
		} else {
			Page.number = page.number;
			Page.text = page.text;
			logger.debug("Page with id %s has been changed", Page.id);
			Page.save(function(err) {
				callback(err, Page);
			});
		}
	});
}

function validateBodyMatchesIdSchema(res, json) {
	var empty = validateBodyIsNotEmpty(res, json);
	if(empty) return empty;
	var result = v.id(json);
	var valid = validateBodyMatchesSchema(res, result);
	if(valid) return valid;
}

function validateBodyIsNotEmpty(res, json) {
	if(!json) {
		logger.info("Request body was empty");
		return "Request body was empty";
	}
}

function validateBodyMatchesBookSchema(res, json, isIdRequired) {
	var empty = validateBodyIsNotEmpty(res, json);
	if(empty) return empty;
	var result = v.book(json, isIdRequired);
	var valid = validateBodyMatchesSchema(res, result);
	if(valid) return valid;
}

function validateBodyMatchesSchema(res, result) {
	if(!result.valid) {
		logger.info("Invalid schema, error " , result.errors);
		return "Invalid schema";
	}
}

function success(res) {
	res.status(200).json({success:"success"});
}

function sendError(res) {
	res.status(500).json({error:"There was a problem processing your request"});
}

function determineSuccess(err, res) {
	if(err) {
		logger.info('There was an issue with this request', err);
		sendError(res);
	} else {
		success(res);
	}
}

module.exports = router;