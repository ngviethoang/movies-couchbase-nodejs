let couchbase = require('couchbase');
require('dotenv').config();

let cluster = new couchbase.Cluster(process.env.COUCHBASE_HOST);
cluster.authenticate(process.env.COUCHBASE_USER, process.env.COUCHBASE_PASSWORD);

let N1qlQuery = couchbase.N1qlQuery;

let execQuery = async (bucketName, n1qlQuery) =>
	new Promise((resolve, reject) => {
        console.log(`Couchbase: Bucket: ${bucketName} | Query: ${n1qlQuery}`);

        let bucket = cluster.openBucket(bucketName);
        let query = N1qlQuery.fromString(n1qlQuery);

        bucket.query(query, (err, rows, meta) => {
            if(err) {
            	console.error(err);
            	resolve(null)
            }
            let metrics = meta !== null && meta.hasOwnProperty('metrics') ? meta.metrics : {};
            resolve({rows, metrics})
        })
	});

let getMovies = async (field, query, orderBy, limit, page) => {
	let n1qlQuery = 'SELECT *, META().id FROM movies';

	if(field === undefined)
	    field = 'title'; //DEFAULT
    else if(field === 'id')
        field = 'META().id';

    let whereQuery = '';
    if(query !== undefined) {
	    if(field === 'title')
            whereQuery = ` WHERE ${field} LIKE "%${query}%"`;
	    else if(field === 'r_year')
            whereQuery = ` WHERE ${field} = ${query}`;
        else
            whereQuery = ` WHERE ${field} = "${query}"`;
	}
	n1qlQuery += whereQuery;

	if(orderBy !== undefined && orderBy !== '') {
	    let orderByArr = orderBy.split(',');

	    if(orderByArr.length >= 1) {
            let orderField = orderByArr[0];
            if(orderField === 'id')
                orderField = 'META().id';

            n1qlQuery += ` ORDER BY ${orderField}`;

            if(orderByArr.length === 2 && orderByArr[1].toLowerCase().trim() === 'desc') {
                n1qlQuery += ' DESC'
            }
        }
    }

    limit = parseInt(limit);
	page = parseInt(page);

	if(!isNaN(limit) && Number.isInteger(limit)) {
        n1qlQuery += ' LIMIT ' + limit;

		if(!isNaN(page) && Number.isInteger(page)) {
            n1qlQuery += ' OFFSET ' + ((page-1) * limit);
        }
	}

	//Count result number
    n1qlQuery = `SELECT COUNT(*) AS total FROM movies${whereQuery} UNION (${n1qlQuery})`;

	let movies = [], total = 0, metrics = {};
	try {
        let res = await execQuery('movies', n1qlQuery);
        if(res !== null) {
	        let rows = res.rows;

	        let totalIndex = rows.findIndex(r => r.hasOwnProperty('total'));
	        if(totalIndex >= 0) {
	            total = rows[totalIndex].total;
	            rows.splice(totalIndex, 1);
	        }

	        movies = rows;
	        metrics = res.metrics;
        }
	} catch (e) {
		
    }

    metrics.query = n1qlQuery;

    return {
	    total,
        metrics,
        movies: movies.map(m => {
            let _m = parseMovie(m);

            if(query !== undefined) {
                _m.title = _m.title.replace(query, `<b>${query}</b>`)
            }
            return _m
        })
    }
};

let getMovie = async (id, customersOrderBy, customersLimit, customersPage) => {
    let movie, metrics = {};
    try {
        let movieQuery = `SELECT *, META().id FROM movies WHERE META().id = "${id}"`;
        let res = await execQuery('movies', movieQuery);

        if(res !== null) {
        	metrics.movie = res.metrics;
	        metrics.movie.query = movieQuery;

	        let movies = res.rows;
	        if(movies.length === 0) {
	            movie = null;
	        } else {
	            movie = parseMovie(movies[0]);

	            let ratingRes = await getRating(id);
	            if(ratingRes !== null) {
	                movie.rating = ratingRes.rating;
	                metrics.rating = ratingRes.metrics;
	                metrics.rating.query = ratingRes.query;
	            } else {
	                movie.rating = null
	            }

	            let customersRes = await getCustomersAndRating(id, customersOrderBy, customersLimit, customersPage);
	            movie.customers = customersRes.customers;
	            metrics.customers = customersRes.metrics;
	            metrics.customers.query = customersRes.query;
	        }
        }
    } catch (e) {
        movie = null
    }

    return {
        movie, metrics
    }
};

let getRating = async (movieId) => {
    try {
        let query = `SELECT AVG(ratings.r) AS ratings FROM movies JOIN ratings ON KEY ratings.mid FOR movies WHERE META(movies).id = "${movieId}" GROUP BY ratings.mid`;
        let res = await execQuery('movies', query);

        if(res !== null) {
		    let ratings = res.rows;
		    if(ratings.length === 0) return null;

		    return {
		        rating: ratings[0].ratings,
		        metrics: res.metrics,
		        query
		    }
        }
    } catch (e) {}
    
    return null
};

//OrderBy: name, rating
let getCustomersAndRating = async (movieId, orderBy, limit, page) => {
    let n1qlQuery = `SELECT customers, META(customers).id AS cid, ratings.r AS rating FROM movies JOIN ratings ON KEY ratings.mid FOR movies JOIN customers ON KEYS ratings.cid WHERE META(movies).id = "${movieId}"`;

    if(orderBy !== undefined) {
        let orderByArr = orderBy.split(',');

        if(orderByArr.length >= 1) {
            let orderField = orderByArr[0];
            if(orderField === 'name')
                orderField = 'customers.name';

            n1qlQuery += ` ORDER BY ${orderField}`;

            if(orderByArr.length === 2 && orderByArr[1].toLowerCase().trim() === 'desc') {
                n1qlQuery += ' DESC'
            }
        }
    }

    limit = parseInt(limit);
    page = parseInt(page);

    if(!isNaN(limit) && Number.isInteger(limit)) {
        n1qlQuery += ' LIMIT ' + limit;

        if(!isNaN(page) && Number.isInteger(page)) {
            n1qlQuery += ' OFFSET ' + ((page-1) * limit);
        }
    }

    try {
    	let res = await execQuery('movies', n1qlQuery);
    	if(res !== null) {
	        let customers = res.rows;
	        if(customers.length === 0) customers = [];

	        return {
	            customers: customers.map(c => parseCustomer(c)),
	            metrics: res.metrics,
	            query: n1qlQuery
	        }
    	}
    } catch (e) {}

    return {customers: [], metrics: null, query: n1qlQuery}
};

let parseMovie = movie => {
    let m = movie.movies;
    if(movie.hasOwnProperty('id'))
        m.id = movie.id;
    return m
};

let parseCustomer = customer => {
    let m = customer.customers;
    m.rating = customer.rating;
    m.id = customer.cid;
    return m
};

module.exports = {
	getMovies,
    getMovie
};