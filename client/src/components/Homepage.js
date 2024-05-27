import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import randomCodeGenerator from '../utils/makeId';
import axios from 'axios';

const Homepage = () => {
    const [roomCode, setRoomCode] = useState('');
    const [username, setUsername] = useState('');
    const [password, setPassword] = useState('');
    const [isAuthenticated, setIsAuthenticated] = useState(false);
    const [updateFlag, setUpdateFlag] = useState(false);

    useEffect(() => {
        const isAuthenticatedValue = localStorage.getItem('isAuthenticated');
        if (isAuthenticatedValue) {
            setIsAuthenticated(true);
            localStorage.removeItem('isAuthenticated'); // Удаляем значение из localStorage после использования
        }
    }, []);

    const register = async () => {
        try {
            await axios.post('https://uno-online-5uml.onrender.com/register', { username, password });
            alert('User registered successfully');
            await login();
        } catch (error) {
            alert(error.response.data.message);
        }
    };

    const login = async () => {
        try {
            const response = await axios.post('https://uno-online-5uml.onrender.com/login', { username, password });
            localStorage.setItem('token', response.data.token);
            localStorage.setItem('username', username);
            setIsAuthenticated(true);
            await fetchStats();
        } catch (error) {
            alert(error.response.data.message);
        }
    };

    const fetchStats = async () => {
        try {
            const token = localStorage.getItem('token');
            const response = await axios.get('https://uno-online-5uml.onrender.com/stats', { headers: { Authorization: `Bearer ${token}` } });
            localStorage.setItem('gamesPlayed', response.data.gamesPlayed);
            localStorage.setItem('gamesWon', response.data.gamesWon);
            if(!updateFlag) setUpdateFlag(prev => !prev);
        } catch (error) {
            alert('Failed to fetch stats');
        }
    };

    return (
        <div className='Homepage'>
            <div className='homepage-menu'>
                <img src='assets/logo.png' width='200px' alt=''/>
                <div className='homepage-form'>
                    {isAuthenticated ? (
                        <>
                            <h1>{`Hello ${localStorage.getItem('username')}!`}</h1>
                            <div className='homepage-join'>
                                <input type='text' placeholder='Game Code' onChange={(event) => setRoomCode(event.target.value)} />
                                <Link to={`/play?roomCode=${roomCode}&username=${username}`}><button className="game-button green">JOIN GAME</button></Link>
                            </div>
                            <h1>OR</h1>
                            <div className='homepage-create'>
                                <Link to={`/play?roomCode=${randomCodeGenerator(5)}&username=${username}`}><button className="game-button orange">CREATE GAME</button></Link>
                            </div>
                            <div className='stats'>
                                <p>Games Played: {localStorage.getItem('gamesPlayed')}</p>
                                <p>Games Won: {localStorage.getItem('gamesWon')}</p>
                            </div>
                        </>
                    ) : (
                        <div>
                            <input type='text' placeholder='Username' onChange={(event) => setUsername(event.target.value)} />
                            <input type='password' placeholder='Password' onChange={(event) => setPassword(event.target.value)} />
                            <button onClick={register} className="game-button blue">REGISTER</button>
                            <button onClick={login} className="game-button blue">LOGIN</button>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
};

export default Homepage;
