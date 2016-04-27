"use strict";
module.exports = function(db, cb){
    db.load('./models', function(err) { 
		if (err) { 
			return cb(err); 
		} 
	});
    return cb();
};