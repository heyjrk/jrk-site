build:
	npm install
	npx tailwindcss -i ./assets/css/input.css -o ./assets/css/output.css --minify
	# Keep baseURL at https://realjrk.com/ (config.toml). Do not pass -b $$CF_PAGES_URL.
	hugo --minify
