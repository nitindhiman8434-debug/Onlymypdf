# OnlyMyPDF backend (Laravel) — PHP-FPM + CLI for API, Horizon, scheduler.
FROM php:8.3-cli

# System deps for Laravel + common PDF tooling hooks.
RUN apt-get update && apt-get install -y \
    git unzip libzip-dev libpng-dev libonig-dev libxml2-dev \
    && docker-php-ext-install pdo_mysql zip gd bcmath \
    && rm -rf /var/lib/apt/lists/*

# Redis extension for queues/cache.
RUN pecl install redis && docker-php-ext-enable redis

COPY --from=composer:2 /usr/bin/composer /usr/bin/composer

WORKDIR /var/www/html
COPY . .

# Install dependencies if composer.lock is present (skipped gracefully otherwise).
RUN composer install --no-interaction --no-progress --prefer-dist || true

EXPOSE 8000
CMD ["php", "artisan", "serve", "--host=0.0.0.0", "--port=8000"]
