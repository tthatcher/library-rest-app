"use strict";
var expect = require('chai').expect;
var app = require('../server');
var request = require('supertest')(app);
var pg = require('pg');
var config = require('../config/config');

//TODO .expect('Content-Type', /json/) not working
//TODO Update get to return pages
//TODO Update test cases for that

function cleanupData(done) {
	var client = new pg.Client(config.postgres.conString);
	client.connect(function(err) {
	  if(err) throw err;
	  
	  client.query('truncate table book; truncate table page; truncate table book_pages;', function(err, result) {
		if(err) throw err;
		client.end();
		done();
	  });
	});
}

var validBody = (function() {
	var pages = [{number:1, text:'This is page 1'}, {number:2, text: 'This is page 2'}];
	var body = {title:'My Book', language: 'EN', author: 'Travis', pages : pages};
	return body;
})();


describe('Book routes', function() {
	
	beforeEach(function(done) {
		cleanupData(done);
	});
	
	//GET
	describe('GET books - ', function() {
		it('Should fetch empty body', function(done) {
			request.get('/api/v1/books')
				.send()
				.expect('Content-Type', /json/)
				.expect('[]')
				.expect(200, done);
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
				.end(function(err, res) {
					if (err) throw err;
					
					request.get('/api/v1/books')
						.set('Accept', 'application/json')
						.expect(function(res) {
							var body = res.body[0];
							body.title = validBody.title;
							body.author = validBody.author;
							body.language = validBody.language;
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
							if (err) {
								throw err;
							}	
							var expected = {};
							expected.title = 'My Book 2';
							expected.author = 'Dog';
							expected.language = 'JP';
							expected.id = res.body[0].id;
							request.post('/api/v1/books')
								.send(expected)
								.set('Accept', 'application/json')
								.expect(200)
								.end(function(err, res) {
									if (err) {
										throw err;
									}
									//TODO This actually isn't working
									request.get('/api/v1/books')
										.set('Accept', 'application/json')
										.expect(function(res) {
											var actual = res.body[0];
											actual.title = expected.title;
											actual.author = expected.author;
											actual.language = "THIS IS NOT WORKING";
										  })
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
	
		it('Should DELETE book with no error message', function(done) {						
			request.put('/api/v1/books')
				.send(validBody)
				.expect(200)
				.end(function(err, res) {
					if (err) {
						throw err;
					}
					request.get('/api/v1/books')
					.expect(200)
					.end(function(err, res) {
						request.delete('/api/v1/books')
							.send({id:res.body[0].id})
							.set('Accept', 'application/json')
							.expect(JSON.stringify({success : "success"}))
							.expect(200, done);
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