"use strict";
var expect = require('chai').expect;
var app = require('../server');
var request = require('supertest')(app);
var pg = require('pg');
var async = require('async');
var config = require('../config/config');
var messages = require('../app/util/controllerUtil').messages;
var success = JSON.stringify({success: messages.success});
var emptyBodyError = JSON.stringify({error: messages.error.emptyBody});
var invalidSchemaError = JSON.stringify({error: messages.error.invalidSchema});
var notFoundError = JSON.stringify({error: 'Not found'});

function cleanupData(done) {
	executeQuery(() => done(),
		'truncate table book; truncate table page; truncate table book_pages;');
}

function doesNotHavePages(callback) {
	executeQuery(function (result) {
		callback(result.rows[0].exists);
	}, 'select (not exists(select 1 from page) and not exists(select 1 from book_pages)) as "exists";');
}

function stringWithLength(len) {
	return new Array(len+1).join('x');
}

function executeQuery(callback, query) {
	var client = new pg.Client(config.postgres.conString);
	client.connect(function (err) {
		if (err)
			throw err;
		client.query(query, function (err, result) {
			if (err)
				throw err;
			client.end();
			callback(result);
		});
	});
}

var validBody = (function () {
	var pages = [{
			number : 1,
			text : 'This is page 1'
		}, {
			number : 2,
			text : 'This is page 2'
		}
	];
	var body = {
		title : 'My Book',
		language : 'EN',
		author : 'Travis',
		pages : pages
	};
	return body;
})();

function addValidBook(callback) {
	addBook(validBody, callback);
}

function addBook(body, callback) {
	request.put('/api/v1/books')
	.send(body)
	.expect(200)
	.expect(success)
	.end(function (err) {
		callback(err);
	});
}

function responseMatchesValidBody(book) {
	var page1 = book.pages[0];
	var page2 = book.pages[1];
	expect(book.id).to.be.a('number');
	expect(book.title).to.equal(validBody.title);
	expect(book.language).to.equal(validBody.language);
	expect(book.author).to.equal(validBody.author);
	expect(page1.id).to.be.a('number');
	expect(page1.number).to.equal(validBody.pages[0].number);
	expect(page1.text).to.equal(validBody.pages[0].text);
	expect(page2.id).to.be.a('number');
	expect(page2.text).to.equal(validBody.pages[1].text);
	expect(page2.number).to.equal(validBody.pages[1].number);
}

describe('Book routes', function () {

	//This is really dumb, but the schema isn't created when the tests start
	before(function (done) {
		setTimeout(function () {
			done();
		}, 250);
	});

	beforeEach(function (done) {
		cleanupData(done);
	});

	describe('GET books - ', function () {
		it('GET with empty table Should fetch empty body', function (done) {
			request.get('/api/v1/books')
			.send()
			.expect('Content-Type', /json/)
			.expect('[]')
			.expect(200, done);
		});

		it('GET with two books should fetch two books', function (done) {
			async.series([
					function (callback) {
						addValidBook(function (err, res) {
							callback(err, res);
						});
					},
					function (callback) {
						addValidBook(function (err, res) {
							callback(err, res);
						});
					},
					function (callback) {
						request.get('/api/v1/books')
						.send()
						.expect('Content-Type', /json/)
						.expect(function (res) {
							var books = res.body;
							expect(books).to.have.length.of(2);
							books.forEach(function (book) {
								responseMatchesValidBody(book);
							});
						})
						.expect(200, done);
					}
				]);
		});
	});

	describe('PUT books - ', function () {
	
		function expectPutResultsInInvalidSchemaError(body, done) {
			request.put('/api/v1/books')
			.send(body)
			.set('Accept', 'application/json')
			.expect(invalidSchemaError)
			.expect(500, done);
		}
		
		function expectPutResultsInSuccess(body, done) {
			request.put('/api/v1/books')
			.send(body)
			.set('Accept', 'application/json')
			.expect(success)
			.expect(200, done);
		}

		it('PUT with valid schema results in success', function (done) {
			expectPutResultsInSuccess(validBody, done);
		});

		it('Successful PUT can be accessed through GET', function (done) {
			request.put('/api/v1/books')
			.send(validBody)
			.expect(200)
			.expect(success)
			.end(function (err, res) {
				if (err)
					throw err;
				request.get('/api/v1/books')
				.set('Accept', 'application/json')
				.expect(function (res) {
					var book = res.body[0];
					responseMatchesValidBody(book);
				})
				.expect(200, done);
			});
		});

		it('PUT with invalid book schema should result in error', function (done) {
			var pages = [{
					number : 1,
					text : 'This is page 1'
				}, {
					number : 2,
					text : 'This is page 2'
				}
			];
			var body = {
				title : 'My Book',
				language : 'EN',
				pages : pages
			};
			expectPutResultsInInvalidSchemaError(body, done);
		});

		it('PUT with invalid page schema should result in error', function (done) {
			var pages = [{
					number : 1,
					text : 'This is page 1'
				}, {
					number : 2
				}
			];
			var body = {
				title : 'My Book',
				language : 'EN',
				author : 'Travis',
				pages : pages
			};
			expectPutResultsInInvalidSchemaError(body, done);
		});
		
		it('PUT with invalid page number results in failure', function (done) {
			var pages = [{
					number : -1,
					text : 'This is page -1'
				}, {
					number : 2,
					text : 'This is page 2'
				}
			];
			var body = {
				title : 'My Book',
				language : 'EN',
				author : 'Travis',
				pages : pages
			};
			
			expectPutResultsInInvalidSchemaError(body, done);
		});
		
		it('PUT with empty request body results in error', function (done) {
			request.put('/api/v1/books')
			.send({})
			.set('Accept', 'application/json')
			.expect(emptyBodyError)
			.expect(500, done);
		});
		
		it('PUT without pages does not result in error', function (done) {
			var body = {title: 'My Book', author: 'An author', language:'EN'};
			expectPutResultsInSuccess(body, done);
		});
		
		it('PUT with author greater than 100 characters results in error', function (done) {
			var body = {title: 'My Book', author: stringWithLength(101), language:'EN'};
			expectPutResultsInInvalidSchemaError(body, done);
		});
		
		it('PUT with title greater than 500 characters results in error', function (done) {
			var body = {title: stringWithLength(501), author: 'Author', language:'EN'};
			expectPutResultsInInvalidSchemaError(body, done);
		});
		
		it('PUT with language with greater than 2 characters results in error', function (done) {
			var body = {title: 'This is a title', author: 'Author', language:'ENG'};
			expectPutResultsInInvalidSchemaError(body, done);
		});
		
		it('PUT with 500 character title does not result in error', function (done) {
			var body = {title: stringWithLength(500), author: 'An author', language:'EN'};
			expectPutResultsInSuccess(body, done);
		});
		
		it('PUT with 100 character author does not result in error', function (done) {
			var body = {title: 'A title', author: stringWithLength(100), language:'EN'};
			expectPutResultsInSuccess(body, done);
		});
		
		it('PUT with 1000 character page text does not result in error', function (done) {
			var body = {title: 'A title', author: 'Author', language:'EN'};
			body.pages = [{text: stringWithLength(1000), number:1}];;
			expectPutResultsInSuccess(body, done);
		});
		
		it('PUT with 1001 character page text results in error', function (done) {
			var body = {title: 'A title', author: 'Author', language:'EN'};
			body.pages = [{text: stringWithLength(1001), number:1}];
			expectPutResultsInInvalidSchemaError(body, done);
		});
		
	});

	describe('POST books - ', function () {
	
		function expectPostResultsInNotFoundError(body, done) {
			expectPostResultsInError(body, done, notFoundError);
		}
	
		function expectPostResultsInInvalidSchemaError(body, done) {
			expectPostResultsInError(body, done, invalidSchemaError);
		}
		
		function expectPostResultsInError(body, done, error) {
			request.post('/api/v1/books')
			.send(body)
			.set('Accept', 'application/json')
			.expect(error)
			.expect(500, done);
	
		}
		
		function getResults(callback) {
			request.get('/api/v1/books')
			.send()
			.expect('Content-Type', /json/)
			.expect(200)
			.end(callback);
		}
		
		function postSucceeds(body, done) {
			request.post('/api/v1/books')
			.send(body)
			.set('Accept', 'application/json')
			.expect(success)
			.expect(200, done);
		}
				
		function expectPostResultsInNotFound(body, callback) {
			request.post('/api/v1/books')
			.send(body)
			.set('Accept', 'application/json')
			.expect(notFoundError)
			.expect(500)
			.end(function(err, res) {
				callback(err);
			});
		}
		
		function expectGetMatchesInput(expected, done) {
			request.get('/api/v1/books')
			.send()
			.expect('Content-Type', /json/)
			.expect(200)
			.expect(expected, done);
		}
		
		function createExpectedForValidBody(res) {
			var body = res.body[0];
			var expected = [{
					title : validBody.title,
					author : validBody.author,
					language : validBody.language,
					id : body.id,
					pages : [{
							id : body.pages[0].id,
							text : validBody.pages[0].text,
							number : validBody.pages[0].number
						}, {
							id : body.pages[1].id,
							text : validBody.pages[1].text,
							number : validBody.pages[1].number
						}
					]
				}
			];
			return expected;
		}

		it('POST with empty request body results in error', function (done) {
			request.post('/api/v1/books')
			.send({})
			.set('Accept', 'application/json')
			.expect(emptyBodyError)
			.expect(500, done);
		});

		it('Should POST book with no error message', function (done) {
			request.put('/api/v1/books')
			.send(validBody)
			.expect(success)
			.expect(200)
			.end(function (err, res) {
				if (err)
					throw err;

				request.get('/api/v1/books')
				.set('Accept', 'application/json')
				.expect(200)
				.end(function (err, res) {
					if (err)
						throw err;

					var expectedBook = {};
					expectedBook.title = 'My Book 2';
					expectedBook.author = 'Dog';
					expectedBook.language = 'JP';
					expectedBook.id = res.body[0].id;
					var expectedPage1 = {};
					expectedPage1.text = 'New text 1';
					expectedPage1.number = 5;
					expectedPage1.id = res.body[0].pages[0].id;
					var expectedPage2 = {};
					expectedPage2.text = 'New text 2';
					expectedPage2.number = 100;
					expectedPage2.id = res.body[0].pages[1].id;
					expectedBook.pages = [expectedPage1, expectedPage2];
					request.post('/api/v1/books')
					.send(expectedBook)
					.set('Accept', 'application/json')
					.expect(200)
					.expect(success)
					.end(function (err, res) {
						if (err)
							throw err;
						request.get('/api/v1/books')
						.set('Accept', 'application/json')
						.expect([{
									title : expectedBook.title,
									author : expectedBook.author,
									language : expectedBook.language,
									id : expectedBook.id,
									pages : [expectedPage1, expectedPage2]
								}
							])
						.expect(200, done);
					});
				})
			});
		});

		it('POST with no id on page should result in error', function (done) {
			var pages = [{
					id : 1,
					number : 1,
					text : 'This is page 1'
				}, {
					number : 2,
					text : 'This is page 2'
				}
			];
			var body = {
				id : 1,
				title : 'My Book',
				language : 'EN',
				author : 'Travis',
				pages : pages
			};
			request.post('/api/v1/books')
			.send(body)
			.set('Accept', 'application/json')
			.expect(invalidSchemaError)
			.expect(500, done);
		});

		it('POST with no id on book should result in error', function (done) {
			var pages = [{
					id : 1,
					number : 1,
					text : 'This is page 1'
				}, {
					id : 2,
					number : 2,
					text : 'This is page 2'
				}
			];
			var body = {
				title : 'My Book',
				language : 'EN',
				author : 'Travis',
				pages : pages
			};
			request.post('/api/v1/books')
			.send(body)
			.set('Accept', 'application/json')
			.expect(invalidSchemaError)
			.expect(500, done);
		});

		it('POST with invalid book schema should result in error', function (done) {
			var pages = [{
					id : 1,
					number : 1,
					text : 'This is page 1'
				}, {
					id : 2,
					number : 2,
					text : 'This is page 2'
				}
			];
			var body = {
				id : 1,
				language : 'EN',
				pages : pages
			};
			request.post('/api/v1/books')
			.send(body)
			.set('Accept', 'application/json')
			.expect(invalidSchemaError)
			.expect(500, done);
		});

		it('POST with invalid page schema should result in error', function (done) {
			var pages = [{
					id : 1,
					number : 1,
					text : 'This is page 1'
				}, {
					id : 2,
					number : 2
				}
			];
			var body = {
				id : 1,
				title : 'My Book',
				language : 'EN',
				author : 'Travis',
				pages : pages
			};
			request.post('/api/v1/books')
			.send(body)
			.set('Accept', 'application/json')
			.expect(invalidSchemaError)
			.expect(500, done);
		});
		
		it('POST with invalid page number results in failure', function (done) {
			async.waterfall([
					addValidBook,
					getResults
				], function(err,res) {
					var body = res.body[0];
					body.pages[0].number = -1;
					request.post('/api/v1/books')
					.send(body)
					.set('Accept', 'application/json')
					.expect(invalidSchemaError)
					.expect(500, done);
				});
		});
		
		it('POST with author greater than 100 characters results in error', function (done) {
			var body = {title: 'My Book', author: stringWithLength(101), language:'EN'};
			expectPostResultsInInvalidSchemaError(body, done);
		});
		
		it('POST with title greater than 500 characters results in error', function (done) {
			var body = {title: stringWithLength(501), author: 'Author', language:'EN'};
			expectPostResultsInInvalidSchemaError(body, done);
		});
		
		it('POST with language with greater than 2 characters results in error', function (done) {
			var body = {title: 'This is a title', author: 'Author', language:'ENG'};
			expectPostResultsInInvalidSchemaError(body, done);
		});
		
		it('POST with book id that does not exist should result in error', function(done) {
			var body = {
				id : 1,
				title : 'My Book',
				language : 'EN',
				author : 'Travis'
			};
			expectPostResultsInNotFoundError(body, done);	
		});
		
		it('POST with page id that does not exist should result in error and not cause update to any pages', function(done) {
			async.waterfall([
					addValidBook,
					getResults,
					function(res, callback) {
						var body = res.body[0];
						body.pages[0].text = 'New text';
						body.pages[0].id = body.pages[0].id + body.pages[1].id ;
						expectPostResultsInNotFound(body, callback);
					},
					getResults
				], function(err, res) {
					var expected = createExpectedForValidBody(res);
					expectGetMatchesInput(expected, done);
				});
		});
		
		it('POST with page id that does not exist should result in error but pages prior to the error will be updated', function(done) {
			async.waterfall([
					addValidBook,
					getResults,
					function(res, callback) {
						var body = res.body[0];
						body.pages[0].text = 'New text';
						body.pages[1].id = body.pages[0].id + body.pages[1].id ;
						expectPostResultsInNotFound(body, callback);
					},
					getResults
				], function(err, res) {
					var expected = createExpectedForValidBody(res);
					expected[0].pages[0].text = 'New text';
					expectGetMatchesInput(expected, done);
				});
		});
		
		it('POST with page text equal to 1000 characters succeeds', function(done) {
			async.waterfall([
					addValidBook,
					getResults
				], function(err, res) {
					var body = res.body[0];
					body.pages[0].text = stringWithLength(1000)
					postSucceeds(body, done);
				});
		});
		
		it('POST with book title equal to 500 characters succeeds', function(done) {
			async.waterfall([
					addValidBook,
					getResults
				], function(err, res) {
					var body = res.body[0];
					body.title = stringWithLength(500);
					postSucceeds(body, done);
				});
		});
		
		it('POST with book author equal to 100 characters succeeds', function(done) {
			async.waterfall([
					addValidBook,
					getResults
				], function(err, res) {
					var body = res.body[0];
					body.author = stringWithLength(100);
					postSucceeds(body, done);
				});
		});
		
		it('POST with book language equal to 2 characters succeeds', function(done) {
			async.waterfall([
					addValidBook,
					getResults
				], function(err, res) {
					var body = res.body[0];
					body.language = stringWithLength(2);
					postSucceeds(body, done);
				});
		});
		
	});

	describe('DELETE books - ', function () {

		it('DELETE with empty request body results in error', function (done) {
			request.delete ('/api/v1/books')
			.send({})
			.set('Accept', 'application/json')
			.expect(emptyBodyError)
			.expect(500, done);
		});

		it('Valid DELETE deletes book and returns success', function (done) {
			request.put('/api/v1/books')
			.send(validBody)
			.expect(200)
			.expect(success)
			.end(function (err, res) {
				if (err)
					throw err;
				request.get('/api/v1/books')
				.expect(200)
				.end(function (err, res) {
					if (err)
						throw err;
					request.delete ('/api/v1/books')
					.send({
						id : res.body[0].id
					})
					.set('Accept', 'application/json')
					.expect(success)
					.expect(200)
					.expect(success)
					.end(function (err, res) {
						if (err)
							throw err;
						request.get('/api/v1/books')
						.expect([])
						.expect(200);
						//Assert that all of the pages have been cascade deleted
						doesNotHavePages(function (result) {
							expect(result).to.be.true;
							done();
						});
					});
				});
			});
		});

		it('DELETE with invalid ID should result in error', function (done) {
			var body = {
				id : -1
			};
			request.delete('/api/v1/books')
			.send(body)
			.set('Accept', 'application/json')
			.expect(invalidSchemaError)
			.expect(500, done);
		});

		it('DELETE with invalid ID type should result in error', function (done) {
			var body = {
				id : "blah"
			};
			request.delete('/api/v1/books')
			.send(body)
			.set('Accept', 'application/json')
			.expect(invalidSchemaError)
			.expect(500, done);
		});
		
		it('DELETE with id that does not exist should result in error', function(done) {
			var body = {
				id : 1,
			};
			request.delete('/api/v1/books')
			.send(body)
			.set('Accept', 'application/json')
			.expect(notFoundError)
			.expect(500, done);
		});
	});
});