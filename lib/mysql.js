let mysql = require('mysql');
require('dotenv').config();

let execQuery = async (query) =>
	new Promise((resolve, reject) => {
        console.log(`Query: ${query}`);

        let con = mysql.createConnection({
            host: process.env.MYSQL_HOST,
            user: process.env.MYSQL_USER,
            password: process.env.MYSQL_PASSWORD,
            database: process.env.MYSQL_DATABASE
        });

        con.connect(err => {
            if (err) {
                console.log(err);
                reject(err)
            }

            con.query(query, (err, result) => {
                if (err) throw err;
                con.end();

                resolve(result)
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
            mysqlQuery += ' OFFSET ' + (page * limit);
        }
	}

	let movies, total = 0;
	try {
        movies = await execQuery(mysqlQuery);

        let res = await execQuery('SELECT COUNT(*) AS total FROM movies ' + whereQuery);
        if(res.length > 0)
            total = res[0].total
	} catch (e) {
		movies = []
    }

    return {
	    total,
        movies: movies.map(m => {
            if(query !== undefined) {
                m.title = m.title.replace(query, `<b>${query}</b>`)
            }
            return m
        })
    }
};

let getMovie = async (id, customersOrderBy, customersLimit, customersPage) => {
    let movie;
    try {
        let movies = await execQuery(`SELECT * FROM movies WHERE id = "${id}"`);

        if(movies.length === 0) return null;

        movie = movies[0];

        movie.rating = await getRating(id);

        movie.customers = await getCustomersAndRating(id, customersOrderBy, customersLimit, customersPage)

    } catch (e) {
        movie = null
    }

    return movie
};

let getRating = async (movieId) => {
    try {
        let ratings = await execQuery(`SELECT AVG(ratings.rating) AS ratings FROM movies JOIN ratings ON ratings.movie_id = movies.id WHERE movies.id = "${movieId}" GROUP BY ratings.movie_id`);

        if(ratings.length === 0) return null;

        return ratings[0].ratings
    } catch (e) {
        return null
    }
};

//OrderBy: name, rating
let getCustomersAndRating = async (movieId, orderBy, limit, page) => {
    try {
    	let mysqlQuery = `SELECT customers.*, ratings.rating AS rating FROM movies JOIN ratings ON ratings.movie_id = movies.id JOIN customers ON customers.id = ratings.customer_id WHERE movies.id = "${movieId}"`;

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
                mysqlQuery += ' OFFSET $' + (page * limit)
            }
        }

    	let customers = await execQuery(mysqlQuery);

        if(customers.length === 0) return [];

        return customers
    } catch (e) {
        return []
    }
};

module.exports = {
	getMovies,
    getMovie
};