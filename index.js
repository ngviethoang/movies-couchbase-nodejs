let express = require('express');
let couchbase = require('./lib/couchbase');
let mysql = require('./lib/mysql');
let path = require('path');
let app = express();

const PORT = process.env.PORT || 5000;

app.use(express.static(path.join(__dirname, 'public')));


app.get('/', (req, res) => res.render('index'));

app.get('/api/couchbase/movies', async (req, res) => {
	let query = req.query.q; //Search query
	let field = req.query.field; //Search field: title, id, r_year
	let limit = req.query.limit; //Page size
	let page = req.query.page; //Page number
	let orderBy = req.query.orderBy; //Order by (field, asc/desc)

	let movies = await couchbase.getMovies(field, query, orderBy, limit, page);

	res.json(movies)
});

app.get('/api/couchbase/movie/:id', async (req, res) => {
	let id = req.params.id;

    //Customers list
	let cLimit = req.query.cLimit;
	let cPage = req.query.cPage;
	let cOrderBy = req.query.cOrderBy;

    let movie = await couchbase.getMovie(id, cOrderBy, cLimit, cPage);

    res.json(movie)
});

app.get('/api/mysql/movies', async (req, res) => {
    let query = req.query.q; //Search query
    let field = req.query.field; //Search field: title, id, r_year
    let limit = req.query.limit; //Page size
    let page = req.query.page; //Page number
    let orderBy = req.query.orderBy; //Order by (field, asc/desc)

    let movies = await mysql.getMovies(field, query, orderBy, limit, page);

    res.json(movies)
});

app.get('/api/mysql/movie/:id', async (req, res) => {
    let id = req.params.id;

    //Customers list
    let cLimit = req.query.cLimit;
    let cPage = req.query.cPage;
    let cOrderBy = req.query.cOrderBy;

    let movie = await mysql.getMovie(id, cOrderBy, cLimit, cPage);

    res.json(movie)
});

app.listen(PORT, () => console.log(`Listening on ${ PORT }`));