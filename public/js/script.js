$(document).ready(() => {

    $(window).scroll(function() {
        if ($(this).scrollTop()) {
            $('#btn-back-to-top').fadeIn()
        } else {
            $('#btn-back-to-top').fadeOut()
        }
    });

    $('#btn-back-to-top').click(() => {
        $('html, body').animate({scrollTop: 0}, 1000)
    });

	let app = new Vue({
		el: '#app',
		data: {
			movies: [],
			searchQuery: null,
            $loading: null,
			movie: {customers: []} //movie in modal
		},
		mounted() {
            this.$loading = $('#movies-list');

			$('.ui.dropdown').dropdown();
            $('.ui.accordion').accordion();

            $('input[name=limit]').change(function () {
				this.searchMovies()
            }.bind(this))
		},
		methods: {
			searchMovies(e) {
				this.searchQuery = e !== undefined ? $(e.target).val() : $('input[name=query]').val();

				this.$loading.addClass('loading');

				let limit = $('input[name=limit]').val();
				$.getJSON('api/movies', {q: this.searchQuery, limit: limit !== '' ? limit : 10 }, function (res) {
					this.movies = res.movies;

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
			}
		},
		computed: {

		}
	})

		


})