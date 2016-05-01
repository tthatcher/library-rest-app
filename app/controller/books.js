"use strict";
var express = require('express');
var router = express.Router();
var async = require('async');
var logger = require('../../config/logger');
var v = require('../validator/validator').validator;

router.get('/', function(req, res) {
	async.waterfall([
		function(callback) {
			req.models.book.find({}, { autoFetch: true }, function(err, books) {
				callback(err, books);
			});
		}
	], function(err, books) {
		if(err) {
			logger.info('There was an issue with this request', err);
			sendError(res);
		} else {
			res.json(books);
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
				async.each(parsedBody.pages, updatePage(req), function(err) {
					callback(err);
				});
			} else {
				callback(null);
			}
		}
	], function(err){
		determineSuccess(err, res)
	});
});

function updatePage(req) {
	return function(page, callback) {
		req.models.page.get(page.id, function(err, Page) {
			if(err) {
				callback(err);
			} else {
				Page.number = page.number;
				Page.text = page.text;
				logger.debug("Page with id %s has been changed", Page.id);
				Page.save(function(err) {
					callback(err);
				});
			}
		});
	}
}

//TODO Cascade delete with constraints
router.delete('/', function(req, res) {
	var parsedBody = req.body;
	async.waterfall([
		function(callback) {
			callback(validateBodyMatchesIdSchema(res, parsedBody));
		},
		function(callback) {
			req.models.book.find({id : parsedBody.id}, { autoFetch: true }, function(err, books) {
				if(!err) logger.info('Book with id %s was found.', books[0].id);
				callback(err, books[0]);
			});
		},
		function(book, callback) {
			book.removePages(function(err){
				if(!err) logger.info('Relations for book with id %s were removed.', book.id);
				callback(err, book);
			});
		},
		function(book, callback) {
			async.each(book.pages, removePage, function(err) {
				callback(err, book);
			});
		},
		function(book, callback) {
			book.remove(function(err) {
				if(!err) logger.info('Book with id %s was removed.', book.id);
				callback(err);
			});
		}
	], function(err){
		determineSuccess(err, res);
	});
});

function removePage(page, callback) {
	page.remove(function(err) {
		if(!err) logger.info('Page with id %s was removed.', page.id);
		callback();
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