const express = require('express');
const socketio = require('socket.io');
const http = require('http');
const cors = require('cors');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { addUser, getUsersInRoom, getUser, removeUser } = require('./users');
const path = require('path');
const db = require('./database');

const PORT = process.env.PORT || 10000;

const app = express();
const server = http.createServer(app);
const io = socketio(server);

app.use(cors());
app.use(express.json());

app.post('/register', (req, res) => {
    const { username, password } = req.body;
    const hashedPassword = bcrypt.hashSync(password, 10);
    const stmt = db.prepare('INSERT INTO users (username, password) VALUES (?, ?)');

    stmt.run(username, hashedPassword, function (err) {
        if (err) {
            return res.status(400).json({ message: 'User already exists' });
        }
        res.json({ message: 'User registered successfully' });
    });
});

app.post('/login', (req, res) => {
    const { username, password } = req.body;
    db.get('SELECT * FROM users WHERE username = ?', [username], (err, user) => {
        if (err || !user) {
            return res.status(401).json({ message: 'Invalid credentials' });
        }
        const isPasswordValid = bcrypt.compareSync(password, user.password);
        if (!isPasswordValid) {
            return res.status(401).json({ message: 'Invalid credentials' });
        }
        const token = jwt.sign({ id: user.id }, 'secret', { expiresIn: '1h' });
        res.json({ token });
    });
});

app.get('/stats', (req, res) => {
    const token = req.headers.authorization.split(' ')[1];
    const payload = jwt.verify(token, 'secret');
    db.get('SELECT gamesPlayed, gamesWon FROM users WHERE id = ?', [payload.id], (err, user) => {
        if (err || !user) {
            return res.status(401).json({ message: 'Invalid token' });
        }
        res.json({ gamesPlayed: user.gamesPlayed, gamesWon: user.gamesWon });
    });
});

app.put('/updateStats', async (req, res) => {
    const { username, gamesPlayed, gamesWon } = req.body;

    db.run(`UPDATE users SET gamesPlayed = ?, gamesWon = ? WHERE username = ?`, [gamesPlayed, gamesWon, username], (err) => {
        if (err) {
            console.error('Error updating user stats:', err.message);
            res.status(500).send('Error updating user stats');
        } else {
            console.log(`User stats updated successfully for ${username}`);
            res.status(200).send('User stats updated successfully');
        }
    });
});

io.on('connection', socket => {
    console.log(socket.id);
    socket.on('join', (payload, callback) => {
        const numberOfUsersInRoom = getUsersInRoom(payload.room).length;
        const { error, newUser } = addUser({
            id: socket.id,
            name: numberOfUsersInRoom === 0 ? 'Player 1' : 'Player 2',
            room: payload.room
        });
        if (error) return callback(error);
        socket.join(newUser.room);

        io.to(newUser.room).emit('roomData', {
            room: newUser.room,
            users: getUsersInRoom(newUser.room)
        });
        socket.emit('currentUserData', { name: newUser.name });
        callback();
    });

    socket.on('initGameState', gameState => {
        const user = getUser(socket.id);
        if (user) io.to(user.room).emit('initGameState', gameState);
    });

    socket.on('updateGameState', gameState => {
        const user = getUser(socket.id);
        if(user) io.to(user.room).emit('updateGameState', gameState);
    });

    socket.on('sendMessage', (payload, callback) => {
        const user = getUser(socket.id);
        if (user) {
            io.to(user.room).emit('message', {
                user: user.name,
                text: payload.message
            });
            callback();
        }
    });

    socket.on('disconnect', () => {
        const user = removeUser(socket.id);
        if (user) {
            io.to(user.room).emit('roomData', {
                room: user.room,
                users: getUsersInRoom(user.room)
            });
        }
    });
});

if (process.env.NODE_ENV === 'production') {
    app.use(express.static(path.join(__dirname, 'client/build')));
    app.get('*', (req, res) => {
        res.sendFile(path.resolve(__dirname, 'client', 'build', 'index.html'));
    });
}

server.listen(PORT, () => {
    console.log(`Сервер запущен на порту ${PORT}`);
});