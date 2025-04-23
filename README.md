# VideoChat Platform

A web-based video chat platform built with Symfony 7.2 and WebRTC.

## Features

- User registration and authentication
- Public and private video chat rooms
- Real-time video and audio communication
- Screen sharing
- Room management (create, join, leave)
- WebRTC for peer-to-peer communication
- WebSocket signaling server for real-time updates

## Technology Stack

- **Backend**: Symfony 7.2 with PHP 8.2+
- **Database**: PostgreSQL
- **Frontend**: Twig, JavaScript, Bootstrap 5
- **WebRTC**: PeerJS library
- **Real-time Communication**: WebSocket server
- **Authentication**: JWT for API, Session for web interface

## Quick Start

### 1. Configure the database

Edit the `.env` file and set up your database connection:

```
DATABASE_URL="postgresql://username:password@127.0.0.1:5432/videochat?serverVersion=16&charset=utf8"
```

### 2. Install dependencies

```bash
composer install
```

### 3. Create the database schema

```bash
php bin/console doctrine:schema:create
```

### 4. Start the signaling server (required for video chat)

```bash
# The most important step - this must be running in a separate terminal!
bin/run-signaling.sh
```

### 5. Start the Symfony development server

```bash
# For development
php bin/console server:start
# Or use Symfony CLI
symfony serve

# For production, use a proper web server like Nginx or Apache with PHP-FPM
```

### 6. Access the application

Open your browser and navigate to:
```
http://localhost:8000
```

## Deployment to a Public Server

### 1. Server Requirements

- PHP 8.2+
- PostgreSQL 13+
- Node.js 14+ (for the signaling server)
- Nginx or Apache web server
- Let's Encrypt SSL certificate for HTTPS (required for WebRTC in production)

### 2. Configure Nginx

Example Nginx configuration:

```nginx
server {
    listen 80;
    server_name your-domain.com;
    return 301 https://$host$request_uri;
}

server {
    listen 443 ssl http2;
    server_name your-domain.com;

    ssl_certificate /etc/letsencrypt/live/your-domain.com/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/your-domain.com/privkey.pem;

    root /var/www/videochat/public;
    index index.php;

    location / {
        try_files $uri /index.php$is_args$args;
    }

    location ~ ^/index\.php(/|$) {
        fastcgi_pass unix:/var/run/php/php8.2-fpm.sock;
        fastcgi_split_path_info ^(.+\.php)(/.*)$;
        include fastcgi_params;
        fastcgi_param SCRIPT_FILENAME $realpath_root$fastcgi_script_name;
        fastcgi_param DOCUMENT_ROOT $realpath_root;
        internal;
    }

    location ~ \.php$ {
        return 404;
    }

    # WebSocket proxy for signaling server
    # This allows you to use the same domain for both the web app and signaling
    location /ws/ {
        proxy_pass http://localhost:3000/;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "upgrade";
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }
}
```

### 3. Set Signaling Server URL in .env.local

Create .env.local from .env.example:

```
# WebRTC Signaling Server URL for production
SIGNALING_SERVER_URL=wss://your-domain.com/ws
```

### 4. Start the Signaling Server as a Service

Create a systemd service file:

```bash
sudo nano /etc/systemd/system/videochat-signaling.service
```

Add the following content:

```
[Unit]
Description=VideoChat Signaling Server
After=network.target

[Service]
Type=simple
User=www-data
WorkingDirectory=/var/www/videochat
ExecStart=/bin/bash /var/www/videochat/bin/run-signaling.sh 3000 127.0.0.1
Restart=on-failure
RestartSec=5

[Install]
WantedBy=multi-user.target
```

Enable and start the service:

```bash
sudo systemctl enable videochat-signaling.service
sudo systemctl start videochat-signaling.service
sudo systemctl status videochat-signaling.service
```

### 5. Final Production Setup

```bash
# Set environment to production
echo "APP_ENV=prod" >> .env.local

# Clear cache
APP_ENV=prod php bin/console cache:clear

# Install assets
APP_ENV=prod php bin/console assets:install

# Set proper permissions
sudo chown -R www-data:www-data var/
sudo chmod -R 775 var/
```

## Using the Platform

1. **Register an account** by clicking on "Register" in the top navigation bar
2. **Create a room** by clicking on "Create a Room" button
3. **Invite others** by sharing the room link or using the invite feature
4. **Join a video call** by entering a room
5. **Manage rooms** from your dashboard

## Troubleshooting

### Camera/Microphone Issues

If you experience issues with camera or microphone access:

1. Make sure your browser has permission to access your camera and microphone
2. Check if your camera is being used by another application
3. Try using a different browser (Chrome, Firefox, or Edge recommended)
4. Check the browser console for specific error messages

### Connection Issues

If users cannot connect to each other:

1. Make sure the signaling server is running (`bin/run-signaling.sh`)
2. Check that your devices are on the same network, or that you have proper internet connectivity
3. Try using a different network if possible (some restrictive networks block WebRTC connections)

## License

This project is licensed under the MIT License - see the LICENSE file for details.