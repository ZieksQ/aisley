FROM composer:2.8 AS vendor

WORKDIR /var/www/html

COPY src/api/composer.json src/api/composer.lock ./
RUN composer install \
    --no-dev \
    --no-interaction \
    --no-progress \
    --prefer-dist \
    --optimize-autoloader \
    --no-scripts

FROM php:8.4-fpm-alpine

WORKDIR /var/www/html

RUN apk add --no-cache \
        freetype-dev \
        icu-dev \
        libjpeg-turbo-dev \
        libpng-dev \
        libwebp-dev \
        libzip-dev \
        oniguruma-dev \
        postgresql-dev \
    && docker-php-ext-configure gd --with-freetype --with-jpeg --with-webp \
    && docker-php-ext-install -j"$(nproc)" \
        bcmath \
        gd \
        intl \
        mbstring \
        opcache \
        pcntl \
        pdo_pgsql \
        zip \
    && addgroup -g 1000 -S aisley \
    && adduser -u 1000 -S -D -G aisley aisley

COPY docker/api/php.ini /usr/local/etc/php/conf.d/99-aisley.ini
COPY --from=vendor /var/www/html/vendor ./vendor
COPY --chown=aisley:aisley src/api/ .

RUN mkdir -p storage/framework/cache storage/framework/sessions storage/framework/views storage/logs bootstrap/cache \
    && chown -R aisley:aisley storage bootstrap/cache

USER aisley

CMD ["php-fpm"]
