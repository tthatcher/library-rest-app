"use strict";
var express = require('express');
var router = express.Router();
var async = require('async');
var logger = require('../../config/logger');
var messages = require('../util/controllerUtil').messages;
var v = require('../validator/validator').validator;

router.get('/', function (req, res) {
	async.waterfall([
			function (callback) {
				req.models.book.find({}, {
					autoFetch : true
				}, function (err, Books) {
					callback(err, Books);
				});
			}
		], function (err, Books) {
		if (err) {
			logger.info('There was an issue with this request', err);
			sendError(res);
		} else {
			res.json(Books);
		}
	});
});

router.put('/', function (req, res) {
	var parsedBody = req.body;

	async.waterfall([
			function (callback) {
				validateBodyMatchesBookSchema(res, parsedBody, false, callback);
			},
			function (callback) {
				req.models.book.create({
					title : parsedBody.title,
					author : parsedBody.author,
					language : parsedBody.language
				}, function (err, Book) {
					if (!err)
						logger.debug("Book with id %s has been added", Book.id);
					callback(err, Book);
				});
			},
			function (Book, callback) {
				if (parsedBody.pages) {
					req.models.page.create(parsedBody.pages, function (err, Pages) {
						if (!err)
							Pages.forEach(x => logger.debug('Page with id %s has been added', x.id));
						callback(err, Book, Pages);
					});
				} else {
					callback(null, Book, null);
				}

			},
			function (Book, Pages, callback) {
				if (Pages) {
					Book.setPages(Pages, function (err) {
						logger.debug('Pages have been set');
						callback(err);
					});
				} else {
					callback(null);
				}
			}
		], function (err) {
		determineSuccess(err, res);
	});
});

router.post('/', function (req, res) {
	var parsedBody = req.body;

	async.waterfall([
			function (callback) {
				validateBodyMatchesBookSchema(res, parsedBody, true, callback);
			},
			function (callback) {
				req.models.book.get(parsedBody.id, function (err, Book) {
					Book.title = parsedBody.title;
					Book.author = parsedBody.author;
					Book.language = parsedBody.language;
					logger.debug("Book with id %s has been changed", Book.id);
					callback(err, Book);
				});
			},
			function (Book, callback) {
				Book.save(function (err) {
					logger.debug("Book with id %s has been saved", Book.id);
					callback(err);
				});
			},
			function (callback) {
				if (parsedBody.pages) {
					async.each(parsedBody.pages, updatePage(req), function (err) {
						callback(err);
					});
				} else {
					callback(null);
				}
			}
		], function (err) {
		determineSuccess(err, res)
	});
});

function updatePage(req) {
	return function (page, callback) {
		req.models.page.get(page.id, function (err, Page) {
			if (err) {
				callback(err);
			} else {
				Page.number = page.number;
				Page.text = page.text;
				logger.debug("Page with id %s has been changed", Page.id);
				Page.save(function (err) {
				    logger.debug("Page with id %s has been saved", Page.id);
					callback(err);
				});
			}
		});
	}
}

router.delete ('/', function (req, res) {
	var parsedBody = req.body;
	async.waterfall([
			function (callback) {
				validateBodyMatchesIdSchema(res, parsedBody, callback);
			},
			function (callback) {
				req.models.book.find({
					id : parsedBody.id
				}, {
					autoFetch : true
				}, function (err, Books) {
					if (!err)
						logger.info('Book with id %s was found.', Books[0].id);
					callback(err, Books[0]);
				});
			},
			function (Book, callback) {
				Book.removePages(function (err) {
					if (!err)
						logger.info('Relations for book with id %s were removed.', Book.id);
					callback(err, Book);
				});
			},
			function (Book, callback) {
				async.each(Book.pages, removePage, function (err) {
					callback(err, Book);
				});
			},
			function (Book, callback) {
				Book.remove(function (err) {
					if (!err)
						logger.info('Book with id %s was removed.', Book.id);
					callback(err);
				});
			}
		], function (err) {
		determineSuccess(err, res);
	});
});

function removePage(page, callback) {
	page.remove(function (err) {
		if (!err)
			logger.info('Page with id %s was removed.', page.id);
		callback(err);
	});
}

function validateBodyMatchesIdSchema(res, json, callback) {
	var err = validateBodyIsNotEmpty(res, json);
	if (err) {
	   return callback(err);
	}
	var result = v.id(json);
    err = validateBodyMatchesSchema(res, result);
	if (err) {
		return callback(err);
	}
	callback(null);
}

function validateBodyIsNotEmpty(res, json) {
	if (Object.keys(json).length === 0) {
		logger.info("Request body was empty");
		return new Error(messages.error.emptyBody);
	}
}

function validateBodyMatchesBookSchema(res, json, isIdRequired, callback) {
	var err = validateBodyIsNotEmpty(res, json);
	if (err) {
	   return callback(err);
	}
	var result = v.book(json, isIdRequired);
	err = validateBodyMatchesSchema(res, result);
	if (err) {
		return callback(err);
	}
	callback(null);
}

function validateBodyMatchesSchema(res, result) {
	if (!result.valid) {
		logger.info("Invalid schema, error ", result.errors);
		return new Error(messages.error.invalidSchema);
	}
}

function success(res) {
	res.status(200).json({success: messages.success});
}

function sendError(err, res) {
	res.status(500).json({error : err.message});
}

function determineSuccess(err, res) {
	if (err) {
		logger.info('There was an issue with this request', err);
		sendError(err, res);
	} else {
		success(res);
	}
}

module.exports = router;
