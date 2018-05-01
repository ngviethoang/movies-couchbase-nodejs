$(document).ready(() => {

    $(window).scroll(function() {
        if ($(this).scrollTop()) {
            $('#btn-back-to-top').fadeIn()
        } else {
            $('#btn-back-to-top').fadeOut()
        }
    });

    $('#btn-back-to-top').click(() => {
        $('html, body').animate({scrollTop: 0}, 500)
    });

	let app = new Vue({
		el: '#app',
        components: { pagination },
		data: {
			movies: [],
			totalResult: 0,
			searchQuery: null,
			searchBy: '',
            $loading: null,
			pagination: {
				total: 0,
				pageSize: 0,
                options: {
                    offset: 2,
                    previousText: '<i class="chevron left icon"></i>',
                    nextText: '<i class="chevron right icon"></i>',
                    alwaysShowPrevNext: false
                }
			},
			movie: {customers: []} //movie in modal
		},
		mounted() {
            this.$loading = $('#movies-list');

			$('.ui.dropdown').dropdown();
            $('.ui.accordion').accordion();

            $('input[name=limit], input[name=searchBy], input[name=orderByField], input[name=orderByAsc]').change(function () {
				this.searchMovies()
            }.bind(this))
		},
		methods: {
			searchMovies(e, page = 1) {
				this.searchQuery = e !== undefined ? $(e.target).val() : $('input[name=query]').val();

				let searchBy = $('input[name=searchBy]').val();
				if(searchBy === '')
					searchBy = 'title';

				this.searchBy = $('input[name=searchBy]').parent().find(`.item[data-value=${searchBy}]`).html();

				let orderBy = $('input[name=orderByField]').val();
				if(orderBy === '')
					orderBy = 'title';

				let orderByAsc = $('input[name=orderByAsc]').val();
				if(orderByAsc === 'desc' || orderByAsc === '')
					orderBy += ',desc';

				this.$loading.addClass('loading');

				let limit = $('input[name=limit]').val();
                limit = limit !== '' ? limit : 10;

				$.getJSON('api/movies', {q: this.searchQuery, field: searchBy, orderBy, limit, page: page - 1 }, function (res) {
					this.movies = res.movies;
					this.totalResult = res.total;

					//Change pagination
					this.pagination.total = this.totalResult;
					this.pagination.pageSize = limit;

					this.$refs.pagination.currentPage = page;

                    $('#btn-back-to-top').click();

					this.$loading.removeClass('loading')
				}.bind(this))
			},
            showMovie(movie) {
                $.getJSON('api/movie/' + movie.id, function (res) {
					this.movie = res.movie;

					this.toggleSegments()
                }.bind(this))
			},
            toggleSegments() {
                $('#movie-segment').transition('fade up');
                $('#search-segment, #results-segment').transition('fade up');
			},
            pageChanged (page) {
                this.searchMovies(undefined, page)
            }
		},
		computed: {

		}
	})

		


})