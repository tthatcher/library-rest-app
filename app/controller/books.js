"use strict";
var express = require('express');
var router = express.Router();
var logger = require('../../config/logger');
var v = require('../validator/validator').validator;

router.get('/', function(req, res) {
	//TODO Should return pages
	var books = req.models.book.find({}, function(error, books) { 
		if(handleError(res, error)) return;
		logger.debug('Returning books', books);
		res.status(200).json(books);
	});
});

router.put('/', function(req, res) {
	var parsedBody = req.body;

	if(validateBodyMatchesBookSchema(res, parsedBody)) return;
	
	req.models.book.create({title: parsedBody.title, author: parsedBody.author, language: parsedBody.language}, function(error, book) {
		logger.debug("Creating book....");
		if(handleError(res, error)) return;
		if(parsedBody.pages) {
			req.models.page.create(parsedBody.pages, function(error, pages) {
				if(handleError(res, error)) return;
				logger.debug("Book with id %s has been added", book.id);
				book.setPages(pages, function(error) {
					if(handleError(res, error)) return;
					success(res);
					pages.forEach(x => logger.debug('Page with id %s has been added', x.id));
				});
			});
		} else {
			success(res);
		}
	});
});

router.post('/', function(req, res) {
	var parsedBody = req.body;
	
	if(validateBodyMatchesBookSchema(res, parsedBody, true)) return;
	
	req.models.book.get(parsedBody.id, function(error, Book) {
		if(handleError(res, error)) return;
		Book.title = parsedBody.title;
		Book.price = parsedBody.author;
		Book.price = parsedBody.language;
		logger.debug("Book with id %s has been changed", Book.id);
		Book.save(function(error) {
			handleError(res, error);
			if(!parsedBody.pages) success(res);
		});
	});
	
	if(parsedBody.pages) {
		parsedBody.pages.forEach(function(page) {
			req.models.page.get(page.id, function(error, Page) {
				if(handleError(res, error)) return;
				Page.number = page.number;
				Page.price = page.text;
				logger.debug("Page with id %s has been changed", Page.id);
				Page.save(function(error) {
					if(handleError(res, error)) return;
					success(res);
				});
			});
		});
	}
	
	
});

router.delete('/', function(req, res) {
	var parsedBody = req.body;
	
	if(validateBodyMatchesIdSchema(res, parsedBody)) return;

	req.models.book.find(parsedBody.id).remove(function(error) {
		if(handleError(res, error)) return;
		success(res);
	});
});


function validateBodyMatchesIdSchema(res, json) {
	if(validateBodyIsNotEmpty(res, json)) return true;
	var result = v.id(json);
	if(validateBodyMatchesSchema(res, result)) return true;
}

function validateBodyMatchesBookSchema(res, json, isIdRequired) {
	if(validateBodyIsNotEmpty(res, json)) return true;
	var result = v.book(json, isIdRequired);
	if(validateBodyMatchesSchema(res, result)) return true;
}

function validateBodyMatchesSchema(res, result) {
	if(!result.valid) {
		logger.info("Invalid schema, error " , result.errors);
		res.status(500).json({error:"Incorrect schema"});
		return true;
	}
}

function validateBodyIsNotEmpty(res, json) {
	if(!json) {
		logger.info("Request body was empty");
		res.status(500).json({error:"Empty body"});
		return true;
	}
}

function success(res) {
	if(!res.headersSent) {
		res.status(200).json({success:"success"});
	}
}

function handleError(res, error) {
	if(error) {
		logger.info('There was an error with this request ', error);
		if(!res.headersSent) {
			res.status(500).json({error:"There was a problem processing your request"});
			return true;
		}
	}
}

module.exports = router;