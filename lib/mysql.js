let mysql = require('mysql');
require('dotenv').config();

let execQuery = async (query) =>
	new Promise((resolve, reject) => {
        console.log(`MySQL: Query: ${query}`);

        let con = mysql.createConnection({
            host: process.env.MYSQL_HOST,
            user: process.env.MYSQL_USER,
            password: process.env.MYSQL_PASSWORD,
            database: process.env.MYSQL_DATABASE
        });

        con.connect(err => {
            if (err) console.error(err);

            let start = process.hrtime();
            con.query(query, (err, rows, fields) => {
                if (err) {
                    console.log(err);
                    resolve(null)
                }

                let end = process.hrtime(start);
                let diff = end[0] + end[1] / 1e6;
                let metrics = {executionTime: diff + 'ms'};

                con.end();
                resolve({rows, metrics})
            })
        })
    });

let getMovies = async (field, query, orderBy, limit, page) => {
	let mysqlQuery = 'SELECT * FROM movies';

	if(field === undefined)
	    field = 'title'; //DEFAULT

    let whereQuery = '';
    if(query !== undefined) {
	    if(field === 'title')
            whereQuery = ` WHERE ${field} LIKE "%${query}%"`;
        else
            whereQuery = ` WHERE ${field} = ${query}`;
	}
	mysqlQuery += whereQuery;

	if(orderBy !== undefined && orderBy !== '') {
	    let orderByArr = orderBy.split(',');

	    if(orderByArr.length >= 1) {
            let orderField = orderByArr[0];

            mysqlQuery += ` ORDER BY ${orderField}`;

            if(orderByArr.length === 2 && orderByArr[1].toLowerCase().trim() === 'desc') {
                mysqlQuery += ' DESC'
            }
        }
    }

    limit = parseInt(limit);
	page = parseInt(page);

	if(!isNaN(limit) && Number.isInteger(limit)) {
        mysqlQuery += ' LIMIT ' + limit;

		if(!isNaN(page) && Number.isInteger(page)) {
            mysqlQuery += ' OFFSET ' + ((page-1) * limit);
        }
	}

	let movies, total = 0, metrics = {};
	try {
        let res = await execQuery(mysqlQuery);
        if(res !== null) {
            movies = res.rows;
            metrics = res.metrics;

            res = await execQuery('SELECT COUNT(*) AS total FROM movies ' + whereQuery);
            if(res.rows.length > 0)
                total = res.rows[0].total
        }
	} catch (e) {
		movies = []
    }
    metrics.query = mysqlQuery;

    return {
	    total,
        metrics,
        movies: movies.map(m => {
            if(query !== undefined) {
                m.title = m.title.replace(query, `<b>${query}</b>`)
            }
            return m
        })
    }
};

let getMovie = async (id, customersOrderBy, customersLimit, customersPage) => {
    let movie, metrics = {};
    try {
        let movieQuery = `SELECT * FROM movies WHERE id = ${id}`;
        let res = await execQuery(movieQuery);
        if(res !== null) {
            metrics.movie = res.metrics;
            metrics.movie.query = movieQuery;

            let movies = res.rows;
            if(movies.length === 0) {
                movie = null;
            } else {
                movie = movies[0];

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
        let query = `SELECT AVG(ratings.rating) AS ratings FROM movies JOIN ratings ON ratings.movie_id = movies.id WHERE movies.id = ${movieId} GROUP BY ratings.movie_id`;
        let res = await execQuery(query);
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
    let mysqlQuery = `SELECT customers.*, ratings.rating AS rating FROM movies JOIN ratings ON ratings.movie_id = movies.id JOIN customers ON customers.id = ratings.customer_id WHERE movies.id = ${movieId}`;

    if(orderBy !== undefined) {
        let orderByArr = orderBy.split(',');

        if(orderByArr.length >= 1) {
            let orderField = orderByArr[0];
            if(orderField === 'name')
                orderField = 'customers.name';

            mysqlQuery += ` ORDER BY ${orderField}`;

            if(orderByArr.length === 2 && orderByArr[1].toLowerCase().trim() === 'desc') {
                mysqlQuery += ' DESC'
            }
        }
    }

    limit = parseInt(limit);
    page = parseInt(page);

    if(!isNaN(limit) && Number.isInteger(limit)) {
        mysqlQuery += ' LIMIT ' + limit;

        if(!isNaN(page) && Number.isInteger(page)) {
            mysqlQuery += ' OFFSET ' + ((page-1) * limit)
        }
    }

    try {
        let res = await execQuery(mysqlQuery);
        if(res !== null) {

            let customers = res.rows;
            if(customers.length === 0) customers = [];

            return {
                customers,
                metrics: res.metrics,
                query: mysqlQuery
            }
        }
    } catch (e) {}
    
    return {customers: [], metrics: null, query: mysqlQuery}
};

module.exports = {
	getMovies,
    getMovie
};