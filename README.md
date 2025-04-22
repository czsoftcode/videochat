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
php bin/console server:start
```

### 6. Access the application

Open your browser and navigate to:
```
http://localhost:8000
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