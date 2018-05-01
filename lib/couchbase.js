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

let getMovies = async (field, query, orderBy, limit, page) => {
	let n1qlQuery = 'SELECT *, META().id FROM movies';
	let placeholders = [];

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
		placeholders.push(limit);
        n1qlQuery += ' LIMIT $' + placeholders.length;

		if(!isNaN(page) && Number.isInteger(page)) {
			placeholders.push(page * limit);
            n1qlQuery += ' OFFSET $' + placeholders.length;
        }
	}

	//Count result number
    n1qlQuery = `SELECT COUNT(*) AS total FROM movies${whereQuery} UNION (${n1qlQuery})`;

	let movies, total = 0;
	try {
        let rows = await execQuery('movies', n1qlQuery, placeholders);
        let totalIndex = rows.findIndex(r => r.hasOwnProperty('total'));
        if(totalIndex >= 0) {
            total = rows[totalIndex].total;
            rows.splice(totalIndex, 1);
        }

        movies = rows;
	} catch (e) {
		movies = []
    }

    return {
	    total,
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
    let movie;
    try {
        let movies = await execQuery('movies', `SELECT *, META().id FROM movies WHERE META().id = "${id}"`);

        if(movies.length === 0) return null;

        movie = parseMovie(movies[0]);

        movie.rating = await getRating(id);

        movie.customers = await getCustomersAndRating(id, customersOrderBy, customersLimit, customersPage)

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

//OrderBy: name, rating
let getCustomersAndRating = async (movieId, orderBy, limit, page) => {
    try {
    	let n1qlQuery = `SELECT customers, ratings.r AS rating FROM movies JOIN ratings ON KEY ratings.mid FOR movies JOIN customers ON KEYS ratings.cid WHERE META(movies).id = "${movieId}"`;
        let placeholders = [];

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
    if(movie.hasOwnProperty('id'))
        m.id = movie.id;
    return m
};

let parseCustomer = customer => {
    let m = customer.customers;
    m.rating = customer.rating;
    return m
};

module.exports = {
	getMovies,
    getMovie
};