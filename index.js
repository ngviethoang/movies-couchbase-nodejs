let express = require('express');
let couchbase = require('./lib/couchbase');
let path = require('path');
let app = express();

const PORT = process.env.PORT || 5000;

app.use(express.static(path.join(__dirname, 'public')));


app.get('/', (req, res) => res.render('index'));

app.get('/api/movies', async (req, res) => {
	let query = req.query.q; //Search query
	let limit = req.query.limit; //Page size
	let page = req.query.page; //Page number

	let movies = await couchbase.getMovies(query, limit, page);

	res.json({movies})
});

app.get('/api/movie/:id', async (req, res) => {
	let id = req.params.id;

    //Customers list
	let c_limit = req.query.c_limit;
	let c_page = req.query.c_page;

    let movie = await couchbase.getMovie(id, c_limit, c_page);

    res.json({movie})
});

app.listen(PORT, () => console.log(`Listening on ${ PORT }`));