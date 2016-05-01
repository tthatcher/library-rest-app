"use strict";
var expect = require('chai').expect;
var app = require('../server');
var request = require('supertest')(app);
var pg = require('pg');
var async = require('async');
var config = require('../config/config');

//TODO .expect('Content-Type', /json/) not working
//TODO Verify error codes (and move them somewhere common)
//TODO Reorganize this, it's hard to read
//TODO Max length tests for fields

function cleanupData(done) {
	executeQuery(() => done(), 
		'truncate table book; truncate table page; truncate table book_pages;');
}

function doesNotHavePages(callback) {
	executeQuery(function(result) {
		callback(result.rows[0].exists);
	}, 'select (not exists(select 1 from page) and not exists(select 1 from book_pages)) as "exists";');
}

function executeQuery(callback, query) {
	var client = new pg.Client(config.postgres.conString);
	client.connect(function(err) {
		if(err) throw err;
		client.query(query, function(err, result) {
			if(err) throw err;
			client.end();
			callback(result);
		});
	});
}

var validBody = (function() {
	var pages = [{number:1, text:'This is page 1'}, {number:2, text: 'This is page 2'}];
	var body = {title:'My Book', language: 'EN', author: 'Travis', pages : pages};
	return body;
})();

function addValidBook(callback) {
	request.put('/api/v1/books')
	.send(validBody)
	.expect(200)
	.end(function(err, res) {
		callback(err, res);
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

describe('Book routes', function() {
	
	//This is really dumb, but the schema isn't created when the tests start
	before(function(done) {
		setTimeout(function() {
			done();
		}, 250);
	});
	
	beforeEach(function(done) {
		cleanupData(done);
	});
	
	//TODO Write test that verifies inserting two books returns two books
	
	//GET
	describe('GET books - ', function() {
		it('GET with empty table Should fetch empty body', function(done) {
			request.get('/api/v1/books')
				.send()
				.expect('Content-Type', /json/)
				.expect('[]')
				.expect(200, done);
		});
		
		it('GET with two books should fetch two books', function(done) {
			async.series([
				function(callback) {
					addValidBook(function(err, res) {
						callback(err, res);
					});
				},
				function(callback) {
					addValidBook(function(err, res) {
						callback(err, res);
					});
				},
				function(callback) {
				request.get('/api/v1/books')
					.send()
					.expect('Content-Type', /json/)
					.expect(function(res) {
						var books = res.body;
						expect(books).to.have.length.of(2);
						books.forEach(function(book) {
							responseMatchesValidBody(book);
						});
					})
					.expect(200, done);
				}
			]);
		});
	});
	
	//PUT
	describe('PUT books - ', function() {
	
		it('PUT with valid schema results in success', function(done) {
			request.put('/api/v1/books')
				.send(validBody)
				.set('Accept', 'application/json')
				.expect(JSON.stringify({success : "success"}))
				.expect(200, done);
		});
		
		it('Successful PUT can be accessed through GET', function(done) {
			request.put('/api/v1/books')
				.send(validBody)
				.expect(200)
				.end(function(err, res) {
					if (err) throw err;
					request.get('/api/v1/books')
						.set('Accept', 'application/json')
						.expect(function(res) {
								var book = res.body[0];
								responseMatchesValidBody(book);
							})
						.expect(200, done);
				  });
		});
		
		it('PUT with invalid book schema should result in error', function(done) {
			var pages = [{number:1, text:'This is page 1'}, {number:2, text: 'This is page 2'}];
			var body = {title:'My Book', language: 'EN', pages : pages};
			request.put('/api/v1/books')
				.send(body)
				.set('Accept', 'application/json')
				.expect(500, done);
		});
		
		it('PUT with invalid page schema should result in error', function(done) {
			var pages = [{number:1, text:'This is page 1'}, {number:2}];
			var body = {title:'My Book', language: 'EN', author: 'Travis', pages : pages};
			request.put('/api/v1/books')
				.send(body)
				.set('Accept', 'application/json')
				.expect(500, done);
		});
	});

	//POST
	describe('POST books - ', function() {
	
		it('POST with empty request body results in error', function(done) {
			request.post('/api/v1/books')
				.send({})
				.set('Accept', 'application/json')
				.expect(500, done);
		});
	
		it('Should POST book with no error message', function(done) {
			request.put('/api/v1/books')
				.send(validBody)
				.end(function(err, res) {
					if (err) throw err;
				
					request.get('/api/v1/books')
						.set('Accept', 'application/json')
						.expect(200)
						.end(function(err, res) {
							if (err) throw err;
							
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
								.end(function(err, res) {
									if (err) throw err;
									request.get('/api/v1/books')
										.set('Accept', 'application/json')
										.expect([{
											title : expectedBook.title,
											author : expectedBook.author,
											language: expectedBook.language,
											id : expectedBook.id,
											pages : [expectedPage1, expectedPage2]
										  }])
										.expect(200, done);
								});
						})
				  });
		});
		
		it('POST with no id on page should result in error', function(done) {
			var pages = [{id:1, number:1, text:'This is page 1'}, {number:2, text: 'This is page 2'}];
			var body = {id:1, title:'My Book', language: 'EN', author: 'Travis', pages : pages};
			request.post('/api/v1/books')
				.send(body)
				.set('Accept', 'application/json')
				.expect(500, done);
		});
		
		it('POST with no id on book should result in error', function(done) {
			var pages = [{id:1, number:1, text:'This is page 1'}, {id:2, number:2, text: 'This is page 2'}];
			var body = {title:'My Book', language: 'EN', author: 'Travis', pages : pages};
			request.post('/api/v1/books')
				.send(body)
				.set('Accept', 'application/json')
				.expect(500, done);
		});
		
		it('POST with invalid book schema should result in error', function(done) {
			var pages = [{id: 1, number:1, text:'This is page 1'}, {id:2, number:2, text: 'This is page 2'}];
			var body = {id:1, language: 'EN', pages : pages};
			request.post('/api/v1/books')
				.send(body)
				.set('Accept', 'application/json')
				.expect(500, done);
		});
		
		it('POST with invalid page schema should result in error', function(done) {
			var pages = [{id: 1, number:1, text:'This is page 1'}, {id: 2, number:2}];
			var body = {id: 1, title:'My Book', language: 'EN', author: 'Travis', pages : pages};
			request.post('/api/v1/books')
				.send(body)
				.set('Accept', 'application/json')
				.expect(500, done);
		});
	});
	
	//DELETE
	describe('DELETE books - ', function() {
	
		it('DELETE with empty request body results in error', function(done) {
			request.delete('/api/v1/books')
				.send({})
				.set('Accept', 'application/json')
				.expect(500, done);
		});
	
		it('Valid DELETE deletes book and returns success', function(done) {						
			request.put('/api/v1/books')
				.send(validBody)
				.expect(200)
				.end(function(err, res) {
					if (err) throw err;
					request.get('/api/v1/books')
						.expect(200)
						.end(function(err, res) {
							if(err) throw err;
							request.delete('/api/v1/books')
								.send({id:res.body[0].id})
								.set('Accept', 'application/json')
								.expect(JSON.stringify({success : "success"}))
								.expect(200)
								.end(function(err, res) {
									if(err) throw err;
									request.get('/api/v1/books')
										.expect([])
										.expect(200);
									//Assert that all of the pages have been cascade deleted
									doesNotHavePages(function(result) {
										expect(result).to.be.true;
										done();
									});
								});
						});
				});
		});
		
		it('DELETE with invalid ID should result in error', function(done) {
			var body = {id:-1};
			request.post('/api/v1/books')
				.send(body)
				.set('Accept', 'application/json')
				.expect(500, done);
		});
		
		it('DELETE with invalid ID type should result in error', function(done) {
			var body = {id:"blah"};
			request.post('/api/v1/books')
				.send(body)
				.set('Accept', 'application/json')
				.expect(500, done);
		});
	});
});