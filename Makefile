default:
	docker build -t fkautz/gist-reveal .

run:
	docker run -i -t -p 8080:8080 fkautz/gist-reveal
