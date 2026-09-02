FROM nginx:1.28-alpine

COPY docker/nginx/default.conf /etc/nginx/conf.d/default.conf
COPY src/api/public /var/www/html/public

EXPOSE 8080
