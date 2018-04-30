let couchbase = require('couchbase');
let cluster = new couchbase.Cluster('couchbase://localhost/');
cluster.authenticate('Administrator', '123456');

let N1qlQuery = couchbase.N1qlQuery;

let execQuery = async (bucketName, n1qlQuery, placeholders = []) =>
	new Promise((resolve, reject) => {
        console.log(`Bucket: ${bucketName} | Query: ${n1qlQuery} | P: ${placeholders.join(', ')}`);

        let bucket = cluster.openBucket(bucketName);
        let query = N1qlQuery.fromString(n1qlQuery);

        bucket.query(query, placeholders, (err, rows) => {
            if(err) console.error(err);
            resolve(rows)
        });
	});

let getMovies = async (query, limit, page) => {
	let n1qlQuery = 'SELECT *, META().id FROM movies';
	let placeholders = [];

	if(query !== undefined) {
		n1qlQuery += ` WHERE title LIKE "%${ query }%"`;
	}

    limit = parseInt(limit);
	page = parseInt(page);

	if(!isNaN(limit) && Number.isInteger(limit)) {
		placeholders.push(limit);
        n1qlQuery += ' LIMIT $' + placeholders.length;

		if(!isNaN(page) && Number.isInteger(page)) {
			placeholders.push(page * limit);
            n1qlQuery += ' OFFSET $' + placeholders.length;
        }
	}

	let movies;
	try {
        movies = await execQuery('movies', n1qlQuery, placeholders);
	} catch (e) {
		movies = []
    }

    return movies.map(m => {
    	let _m = parseMovie(m);

        if(query !== undefined) {
            _m.title = _m.title.replace(query, `<b>${query}</b>`)
        }
    	return _m
	})
};

let getMovie = async (id, c_limit, c_page) => {
    let movie;
    try {
        let movies = await execQuery('movies', `SELECT *, META().id FROM movies WHERE META().id = "${id}"`);

        if(movies.length === 0) return null;

        movie = parseMovie(movies[0]);

        movie.rating = await getRating(id);

        movie.customers = await getCustomersAndRating(id, c_limit, c_page)

    } catch (e) {
        movie = null
    }

    return movie
};

let getRating = async (movieId) => {
    try {
        let ratings = await execQuery('movies', `SELECT AVG(ratings.r) AS ratings FROM movies JOIN ratings ON KEY ratings.mid FOR movies WHERE META(movies).id = "${movieId}" GROUP BY ratings.mid`);

        if(ratings.length === 0) return null;

        return ratings[0].ratings
    } catch (e) {
        return null
    }
};

let getCustomersAndRating = async (movieId, limit, page) => {
    try {
    	let n1qlQuery = `SELECT customers, ratings.r FROM movies JOIN ratings ON KEY ratings.mid FOR movies JOIN customers ON KEYS ratings.cid WHERE META(movies).id = "${movieId}"`;
        let placeholders = [];

        limit = parseInt(limit);
        page = parseInt(page);

        if(!isNaN(limit) && Number.isInteger(limit)) {
            placeholders.push(limit);
            n1qlQuery += ' LIMIT $' + placeholders.length;

            if(!isNaN(page) && Number.isInteger(page)) {
                placeholders.push(page * limit);
                n1qlQuery += ' OFFSET $' + placeholders.length;
            }
        }

    	let customers = await execQuery('movies', n1qlQuery, placeholders);

        if(customers.length === 0) return [];

        return customers.map(c => parseCustomer(c))
    } catch (e) {
        return []
    }
};

let parseMovie = movie => {
    let m = movie.movies;
    m.id = movie.id;
    return m
};

let parseCustomer = customer => {
    let m = customer.customers;
    m.r = customer.r;
    return m
};

module.exports = {
	getMovies,
    getMovie
};