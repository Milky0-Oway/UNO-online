import React, {useEffect, useState} from "react";
import CARDS from '../utils/cards';
import shuffleArray from '../utils/shuffleArray';
import io from 'socket.io-client';
import Spinner from './Spinner';
import {useLocation, useNavigate} from 'react-router-dom';
import '../App.css';
import axios from "axios";

const ENDPOINT = 'https://uno-online-5uml.onrender.com';
/*
const ENDPOINT = 'http://localhost:5000';
*/

let socket;

const Game = (props) => {
    const location = useLocation();
    const queryParams = new URLSearchParams(location.search);
    const roomCode = queryParams.get('roomCode');
    const history = useNavigate();
    const username = queryParams.get('username');
    let gamesPlayed = queryParams.get('gamesPlayed');
    let gamesWon = queryParams.get('gamesWon');
    const [stats, setStats] = useState({ gamesPlayed: gamesPlayed, gamesWon: gamesWon });

    const [room, setRoom] = useState(roomCode);
    const [roomFull, setRoomFull] = useState(false);
    const [users, setUsers] = useState([]);
    const [currentUser, setCurrentUser] = useState('');
    const [message, setMessage] = useState('');
    const [messages, setMessages] = useState([]);
    const [gameOver, setGameOver] = useState(true);
    const [winner, setWinner] = useState('');
    const [player1Deck, setPlayer1Deck] = useState([]);
    const [player2Deck, setPlayer2Deck] = useState([]);
    const [turn, setTurn] = useState('');
    const [playedCardsPile, setPlayedCardsPile] = useState([]);
    const [drawCardPile, setDrawCardPile] = useState([]);
    const [currentColor, setCurrentColor] = useState('');
    const [currentNumber, setCurrentNumber] = useState('');
    const [isChatBoxHidden, setChatBoxHidden] = useState(true);
    const [isUnoButtonPressed, setUnoButtonPressed] = useState(false);


    useEffect(() => {
        const connectionOptions =  {
            "forceNew" : true,
            "reconnectionAttempts": "Infinity",
            "timeout" : 10000,
            "transports" : ["websocket"]
        }
        socket = io.connect(ENDPOINT, connectionOptions)

        socket.emit('join', {room: room}, (error) => {
            if(error)
                setRoomFull(true)
        })

        return function cleanup() {
            socket.disconnect();
        }
    }, [])

    useEffect(() => {
        const shuffledCards = shuffleArray(CARDS);
        const player1Deck = shuffledCards.slice(0, 7);
        const player2Deck = shuffledCards.slice(8, 15);
        let startingCardIndex;
        while (true) {
            startingCardIndex = Math.floor(Math.random() * 94);
            if(shuffledCards[startingCardIndex]==='skipR' || shuffledCards[startingCardIndex]==='_R' || shuffledCards[startingCardIndex]==='D2R' ||
                shuffledCards[startingCardIndex]==='skipG' || shuffledCards[startingCardIndex]==='_G' || shuffledCards[startingCardIndex]==='D2G' ||
                shuffledCards[startingCardIndex]==='skipB' || shuffledCards[startingCardIndex]==='_B' || shuffledCards[startingCardIndex]==='D2B' ||
                shuffledCards[startingCardIndex]==='skipY' || shuffledCards[startingCardIndex]==='_Y' || shuffledCards[startingCardIndex]==='D2Y' ||
                shuffledCards[startingCardIndex]==='W' || shuffledCards[startingCardIndex]==='D4W') {
                continue;
            }
            else
                break;
        }
        const playedCardsPile = shuffledCards.splice(startingCardIndex, 1);
        const drawCardPile = shuffledCards;

        socket.emit('initGameState', {
            gameOver: false,
            turn: 'Player 1',
            player1Deck: [...player1Deck],
            player2Deck: [...player2Deck],
            currentColor: playedCardsPile[0].charAt(1),
            currentNumber: playedCardsPile[0].charAt(0),
            playedCardsPile: [...playedCardsPile],
            drawCardPile: [...drawCardPile]
        });
    }, [socket]);

    useEffect(() => {
        if (!socket) return;

        socket.on('initGameState', ({ gameOver, turn, player1Deck, player2Deck, currentColor, currentNumber, playedCardsPile, drawCardPile }) => {
            setGameOver(gameOver)
            setTurn(turn)
            setPlayer1Deck(player1Deck)
            setPlayer2Deck(player2Deck)
            setCurrentColor(currentColor)
            setCurrentNumber(currentNumber)
            setPlayedCardsPile(playedCardsPile)
            setDrawCardPile(drawCardPile)
        })

        socket.on('updateGameState', ({ gameOver, winner, turn, player1Deck, player2Deck, currentColor, currentNumber, playedCardsPile, drawCardPile }) => {
            gameOver && setGameOver(gameOver)
            winner && setWinner(winner)
            turn && setTurn(turn)
            player1Deck && setPlayer1Deck(player1Deck)
            player2Deck && setPlayer2Deck(player2Deck)
            currentColor && setCurrentColor(currentColor)
            currentNumber && setCurrentNumber(currentNumber)
            playedCardsPile && setPlayedCardsPile(playedCardsPile)
            drawCardPile && setDrawCardPile(drawCardPile)
            setUnoButtonPressed(false)
        })

        socket.on("roomData", ({ users }) => {
            setUsers(users)
        })

        socket.on('currentUserData', ({ name }) => {
            setCurrentUser(name)
        })

        socket.on('message', message => {
            setMessages(messages => [ ...messages, message ])

            const chatBody = document.querySelector('.chat-body')
            chatBody.scrollTop = chatBody.scrollHeight
        })
    }, [socket]);

    const checkGameOver = (arr) => {
        return arr.length === 1;
    }

    const checkWinner = (arr, player) => {
        return arr.length === 1 ? player : '';
    }

    const toggleChatBox = () => {
        const chatBody = document.querySelector('.chat-body');
        if(isChatBoxHidden){
            chatBody.style.display = 'block';
            setChatBoxHidden(false);
        }
        else{
            chatBody.style.display = 'none';
            setChatBoxHidden(true);
        }
    }

    const sendMessage = (event) => {
        event.preventDefault();
        if(message){
            socket.emit('sendMessage', {message: message}, () => {
                setMessage('');
            });
        }
    }

    const onCardPlayedHandler = (played_card) => {
        const cardPlayedBy = turn;
        if(played_card.length === 2 && ((played_card.charAt(0) >= '0' && played_card.charAt(0) <= '9') || played_card.charAt(0) === '_')){
            const numberOfPlayedCard = played_card.charAt(0);
            const colorOfPlayedCard = played_card.charAt(1);
            if(currentColor === colorOfPlayedCard || currentNumber === numberOfPlayedCard){
                if(cardPlayedBy === 'Player 1'){
                    const removeIndex = player1Deck.indexOf(played_card);
                    if(player1Deck.length === 2 && !isUnoButtonPressed){
                        alert('You forgot to press UNO. You drew 2 cards as penalty.');
                        const copiedDrawCardPileArray = [...drawCardPile];
                        const drawCard1 = copiedDrawCardPileArray.pop();
                        const drawCard2 = copiedDrawCardPileArray.pop();
                        const updatedPlayer1Deck = [...player1Deck.slice(0, removeIndex), ...player1Deck.slice(removeIndex+1)];
                        updatedPlayer1Deck.push(drawCard1);
                        updatedPlayer1Deck.push(drawCard2);
                        socket.emit('updateGameState', {
                            gameOver: checkGameOver(player1Deck),
                            winner: checkWinner(player1Deck, 'Player 1'),
                            turn: 'Player 2',
                            playedCardsPile: [...playedCardsPile.slice(0, playedCardsPile.length), played_card, ...playedCardsPile.slice(playedCardsPile.length)],
                            player1Deck: [...updatedPlayer1Deck],
                            currentColor: colorOfPlayedCard,
                            currentNumber: numberOfPlayedCard,
                            drawCardPile: [...copiedDrawCardPileArray]
                        });
                    }
                    else{
                        socket.emit('updateGameState', {
                            gameOver: checkGameOver(player1Deck),
                            winner: checkWinner(player1Deck, 'Player 1'),
                            turn: 'Player 2',
                            playedCardsPile: [...playedCardsPile.slice(0, playedCardsPile.length), played_card, ...playedCardsPile.slice(playedCardsPile.length)],
                            player1Deck: [...player1Deck.slice(0, removeIndex), ...player1Deck.slice(removeIndex + 1)],
                            currentColor: colorOfPlayedCard,
                            currentNumber: numberOfPlayedCard
                        });
                    }
                }
                else{
                    const removeIndex = player2Deck.indexOf(played_card);
                    if(player2Deck.length === 2 && !isUnoButtonPressed){
                        alert('You forgot to press UNO. You drew 2 cards as penalty.');
                        const copiedDrawCardPileArray = [...drawCardPile];
                        const drawCard1 = copiedDrawCardPileArray.pop();
                        const drawCard2 = copiedDrawCardPileArray.pop();
                        const updatedPlayer2Deck = [...player2Deck.slice(0, removeIndex), ...player2Deck.slice(removeIndex+1)];
                        updatedPlayer2Deck.push(drawCard1);
                        updatedPlayer2Deck.push(drawCard2);
                        socket.emit('updateGameState', {
                            gameOver: checkGameOver(player2Deck),
                            winner: checkWinner(player2Deck, 'Player 2'),
                            turn: 'Player 1',
                            playedCardsPile: [...playedCardsPile.slice(0, playedCardsPile.length), played_card, ...playedCardsPile.slice(playedCardsPile.length)],
                            player2Deck: [...updatedPlayer2Deck],
                            currentColor: colorOfPlayedCard,
                            currentNumber: numberOfPlayedCard,
                            drawCardPile: [...copiedDrawCardPileArray]
                        });
                    }
                    else{
                        socket.emit('updateGameState', {
                            gameOver: checkGameOver(player2Deck),
                            winner: checkWinner(player2Deck, 'Player 2'),
                            turn: 'Player 1',
                            playedCardsPile: [...playedCardsPile.slice(0, playedCardsPile.length), played_card, ...playedCardsPile.slice(playedCardsPile.length)],
                            player2Deck: [...player2Deck.slice(0, removeIndex), ...player2Deck.slice(removeIndex + 1)],
                            currentColor: colorOfPlayedCard,
                            currentNumber: numberOfPlayedCard
                        });
                    }
                }
            }
            else{
                alert('Invalid move');
            }
        }
        else if(played_card.length === 5){
            const colorOfPlayedCard = played_card.charAt(4);
            if(currentColor === colorOfPlayedCard || currentNumber === 404){
                if(cardPlayedBy === 'Player 1'){
                    const removeIndex = player1Deck.indexOf(played_card);
                    if(player1Deck.length === 2 && !isUnoButtonPressed){
                        alert('You forgot to press UNO. You drew 2 cards as penalty.');
                        const copiedDrawCardPileArray = [...drawCardPile];
                        const drawCard1 = copiedDrawCardPileArray.pop();
                        const drawCard2 = copiedDrawCardPileArray.pop();
                        const updatedPlayer1Deck = [...player1Deck.slice(0, removeIndex), ...player1Deck.slice(removeIndex+1)];
                        updatedPlayer1Deck.push(drawCard1);
                        updatedPlayer1Deck.push(drawCard2);
                        socket.emit('updateGameState', {
                            gameOver: checkGameOver(player1Deck),
                            winner: checkWinner(player1Deck, 'Player 1'),
                            playedCardsPile: [...playedCardsPile.slice(0, playedCardsPile.length), played_card, ...playedCardsPile.slice(playedCardsPile.length)],
                            player1Deck: [...updatedPlayer1Deck],
                            currentColor: colorOfPlayedCard,
                            currentNumber: 404,
                            drawCardPile: [...copiedDrawCardPileArray]
                        });
                    }
                    else{
                        socket.emit('updateGameState', {
                            gameOver: checkGameOver(player1Deck),
                            winner: checkWinner(player1Deck, 'Player 1'),
                            playedCardsPile: [...playedCardsPile.slice(0, playedCardsPile.length), played_card, ...playedCardsPile.slice(playedCardsPile.length)],
                            player1Deck: [...player1Deck.slice(0, removeIndex), ...player1Deck.slice(removeIndex + 1)],
                            currentColor: colorOfPlayedCard,
                            currentNumber: 404
                        });
                    }
                }
                else{
                    const removeIndex = player2Deck.indexOf(played_card);
                    if(player2Deck.length === 2 && !isUnoButtonPressed){
                        alert('You forgot to press UNO. You drew 2 cards as penalty.');
                        const copiedDrawCardPileArray = [...drawCardPile];
                        const drawCard1 = copiedDrawCardPileArray.pop();
                        const drawCard2 = copiedDrawCardPileArray.pop();
                        const updatedPlayer2Deck = [...player2Deck.slice(0, removeIndex), ...player2Deck.slice(removeIndex+1)];
                        updatedPlayer2Deck.push(drawCard1);
                        updatedPlayer2Deck.push(drawCard2);
                        socket.emit('updateGameState', {
                            gameOver: checkGameOver(player2Deck),
                            winner: checkWinner(player2Deck, 'Player 2'),
                            playedCardsPile: [...playedCardsPile.slice(0, playedCardsPile.length), played_card, ...playedCardsPile.slice(playedCardsPile.length)],
                            player2Deck: [...updatedPlayer2Deck],
                            currentColor: colorOfPlayedCard,
                            currentNumber: 404,
                            drawCardPile: [...copiedDrawCardPileArray]
                        });
                    }
                    else{
                        socket.emit('updateGameState', {
                            gameOver: checkGameOver(player2Deck),
                            winner: checkWinner(player2Deck, 'Player 2'),
                            playedCardsPile: [...playedCardsPile.slice(0, playedCardsPile.length), played_card, ...playedCardsPile.slice(playedCardsPile.length)],
                            player2Deck: [...player2Deck.slice(0, removeIndex), ...player2Deck.slice(removeIndex + 1)],
                            currentColor: colorOfPlayedCard,
                            currentNumber: 404
                        });
                    }
                }
            }
            else{
                alert('Invalid Move!');
            }
        }
        else if(played_card.length === 3 && played_card.charAt(1) === '2'){
            const colorOfPlayedCard = played_card.charAt(2);
            if(currentColor === colorOfPlayedCard || currentNumber === 252){
                if(cardPlayedBy === 'Player 1'){
                    const removeIndex = player1Deck.indexOf(played_card);
                    const copiedDrawCardPileArray = [...drawCardPile];
                    const drawCard1 = copiedDrawCardPileArray.pop();
                    const drawCard2 = copiedDrawCardPileArray.pop();
                    if(player1Deck.length === 2 && !isUnoButtonPressed){
                        alert('You forgot to press UNO. You drew 2 cards as penalty.');
                        const drawCard1X = copiedDrawCardPileArray.pop();
                        const drawCard2X = copiedDrawCardPileArray.pop();
                        const updatedPlayer1Deck = [...player1Deck.slice(0, removeIndex), ...player1Deck.slice(removeIndex+1)];
                        updatedPlayer1Deck.push(drawCard1X);
                        updatedPlayer1Deck.push(drawCard2X);
                        socket.emit('updateGameState', {
                            gameOver: checkGameOver(player1Deck),
                            winner: checkWinner(player1Deck, 'Player 1'),
                            playedCardsPile: [...playedCardsPile.slice(0, playedCardsPile.length), played_card, ...playedCardsPile.slice(playedCardsPile.length)],
                            player1Deck: [...updatedPlayer1Deck],
                            player2Deck: [...player2Deck.slice(0, player2Deck.length), drawCard1, drawCard2, ...player2Deck.slice(player2Deck.length)],
                            currentColor: colorOfPlayedCard,
                            currentNumber: 252,
                            drawCardPile: [...copiedDrawCardPileArray]
                        });
                    }
                    else{
                        socket.emit('updateGameState', {
                            gameOver: checkGameOver(player1Deck),
                            winner: checkWinner(player1Deck, 'Player 1'),
                            playedCardsPile: [...playedCardsPile.slice(0, playedCardsPile.length), played_card, ...playedCardsPile.slice(playedCardsPile.length)],
                            player1Deck: [...player1Deck.slice(0, removeIndex), ...player1Deck.slice(removeIndex + 1)],
                            player2Deck: [...player2Deck.slice(0, player2Deck.length), drawCard1, drawCard2, ...player2Deck.slice(player2Deck.length)],
                            currentColor: colorOfPlayedCard,
                            currentNumber: 252,
                            drawCardPile: [...copiedDrawCardPileArray]
                        });
                    }
                }
                else{
                    const removeIndex = player2Deck.indexOf(played_card);
                    const copiedDrawCardPileArray = [...drawCardPile];
                    const drawCard1 = copiedDrawCardPileArray.pop();
                    const drawCard2 = copiedDrawCardPileArray.pop();
                    if(player2Deck.length === 2 && !isUnoButtonPressed){
                        alert('You forgot to press UNO. You drew 2 cards as penalty.');
                        const drawCard1X = copiedDrawCardPileArray.pop();
                        const drawCard2X = copiedDrawCardPileArray.pop();
                        const updatedPlayer2Deck = [...player2Deck.slice(0, removeIndex), ...player2Deck.slice(removeIndex+1)];
                        updatedPlayer2Deck.push(drawCard1X);
                        updatedPlayer2Deck.push(drawCard2X);
                        socket.emit('updateGameState', {
                            gameOver: checkGameOver(player2Deck),
                            winner: checkWinner(player2Deck, 'Player 2'),
                            playedCardsPile: [...playedCardsPile.slice(0, playedCardsPile.length), played_card, ...playedCardsPile.slice(playedCardsPile.length)],
                            player2Deck: [...updatedPlayer2Deck],
                            player1Deck: [...player1Deck.slice(0, player1Deck.length), drawCard1, drawCard2, ...player1Deck.slice(player1Deck.length)],
                            currentColor: colorOfPlayedCard,
                            currentNumber: 252,
                            drawCardPile: [...copiedDrawCardPileArray]
                        });
                    }
                    else{
                        socket.emit('updateGameState', {
                            gameOver: checkGameOver(player2Deck),
                            winner: checkWinner(player2Deck, 'Player 2'),
                            playedCardsPile: [...playedCardsPile.slice(0, playedCardsPile.length), played_card, ...playedCardsPile.slice(playedCardsPile.length)],
                            player2Deck: [...player2Deck.slice(0, removeIndex), ...player2Deck.slice(removeIndex + 1)],
                            player1Deck: [...player1Deck.slice(0, player1Deck.length), drawCard1, drawCard2, ...player1Deck.slice(player1Deck.length)],
                            currentColor: colorOfPlayedCard,
                            currentNumber: 252,
                            drawCardPile: [...copiedDrawCardPileArray]
                        });
                    }
                }
            }
            else{
                alert('Invalid Move!');
            }
        }
        else if(played_card === 'W'){
            if(cardPlayedBy === 'Player 1'){
                const newColor = prompt('Enter first letter of new color (R/G/B/Y)').toUpperCase();
                const removeIndex = player1Deck.indexOf(played_card);
                if(player1Deck.length === 2 && !isUnoButtonPressed){
                    alert('You forgot to press UNO. You drew 2 cards as penalty.');
                    const copiedDrawCardPileArray = [...drawCardPile];
                    const drawCard1 = copiedDrawCardPileArray.pop();
                    const drawCard2 = copiedDrawCardPileArray.pop();
                    const updatedPlayer1Deck = [...player1Deck.slice(0, removeIndex), ...player1Deck.slice(removeIndex+1)];
                    updatedPlayer1Deck.push(drawCard1);
                    updatedPlayer1Deck.push(drawCard2);
                    socket.emit('updateGameState', {
                        gameOver: checkGameOver(player1Deck),
                        winner: checkWinner(player1Deck, 'Player 1'),
                        turn: 'Player 2',
                        playedCardsPile: [...playedCardsPile.slice(0, playedCardsPile.length), played_card, ...playedCardsPile.slice(playedCardsPile.length)],
                        player1Deck: [...updatedPlayer1Deck],
                        currentColor: newColor,
                        currentNumber: 300,
                        drawCardPile: [...copiedDrawCardPileArray]
                    });
                }
                else{
                    socket.emit('updateGameState', {
                        gameOver: checkGameOver(player1Deck),
                        winner: checkWinner(player1Deck, 'Player 1'),
                        turn: 'Player 2',
                        playedCardsPile: [...playedCardsPile.slice(0, playedCardsPile.length), played_card, ...playedCardsPile.slice(playedCardsPile.length)],
                        player1Deck: [...player1Deck.slice(0, removeIndex), ...player1Deck.slice(removeIndex + 1)],
                        currentColor: newColor,
                        currentNumber: 300
                    });
                }
            }
            else{
                const newColor = prompt('Enter first letter of new color (R/G/B/Y)').toUpperCase();
                const removeIndex = player2Deck.indexOf(played_card);
                if(player2Deck.length === 2 && !isUnoButtonPressed){
                    alert('You forgot to press UNO. You drew 2 cards as penalty.');
                    const copiedDrawCardPileArray = [...drawCardPile];
                    const drawCard1 = copiedDrawCardPileArray.pop();
                    const drawCard2 = copiedDrawCardPileArray.pop();
                    const updatedPlayer2Deck = [...player2Deck.slice(0, removeIndex), ...player2Deck.slice(removeIndex+1)];
                    updatedPlayer2Deck.push(drawCard1);
                    updatedPlayer2Deck.push(drawCard2);
                    socket.emit('updateGameState', {
                        gameOver: checkGameOver(player2Deck),
                        winner: checkWinner(player2Deck, 'Player 2'),
                        turn: 'Player 1',
                        playedCardsPile: [...playedCardsPile.slice(0, playedCardsPile.length), played_card, ...playedCardsPile.slice(playedCardsPile.length)],
                        player2Deck: [...updatedPlayer2Deck],
                        currentColor: newColor,
                        currentNumber: 300,
                        drawCardPile: [...copiedDrawCardPileArray]
                    });
                }
                else{
                    socket.emit('updateGameState', {
                        gameOver: checkGameOver(player2Deck),
                        winner: checkWinner(player2Deck, 'Player 2'),
                        turn: 'Player 1',
                        playedCardsPile: [...playedCardsPile.slice(0, playedCardsPile.length), played_card, ...playedCardsPile.slice(playedCardsPile.length)],
                        player2Deck: [...player2Deck.slice(0, removeIndex), ...player2Deck.slice(removeIndex + 1)],
                        currentColor: newColor,
                        currentNumber: 300
                    });
                }
            }
        }
        else if(played_card === 'D4W'){
            if(cardPlayedBy === 'Player 1'){
                const newColor = prompt('Enter first letter of new color (R/G/B/Y)').toUpperCase();
                const removeIndex = player1Deck.indexOf(played_card);
                const copiedDrawCardPileArray = [...drawCardPile];
                const drawCard1 = copiedDrawCardPileArray.pop();
                const drawCard2 = copiedDrawCardPileArray.pop();
                const drawCard3 = copiedDrawCardPileArray.pop();
                const drawCard4 = copiedDrawCardPileArray.pop();
                if(player1Deck.length === 2 && !isUnoButtonPressed){
                    alert('You forgot to press UNO. You drew 2 cards as penalty.');
                    const drawCard1X = copiedDrawCardPileArray.pop();
                    const drawCard2X = copiedDrawCardPileArray.pop();
                    const updatedPlayer1Deck = [...player1Deck.slice(0, removeIndex), ...player1Deck.slice(removeIndex+1)];
                    updatedPlayer1Deck.push(drawCard1X);
                    updatedPlayer1Deck.push(drawCard2X);
                    socket.emit('updateGameState', {
                        gameOver: checkGameOver(player1Deck),
                        winner: checkWinner(player1Deck, 'Player 1'),
                        playedCardsPile: [...playedCardsPile.slice(0, playedCardsPile.length), played_card, ...playedCardsPile.slice(playedCardsPile.length)],
                        player1Deck: [...player1Deck.slice(0, removeIndex), ...player1Deck.slice(removeIndex + 1)],
                        player2Deck: [...player2Deck.slice(0, player2Deck.length), drawCard1, drawCard2, drawCard3, drawCard4, ...player2Deck.slice(player2Deck.length)],
                        currentColor: newColor,
                        currentNumber: 600,
                        drawCardPile: [...copiedDrawCardPileArray]
                    });
                }
                else{
                    socket.emit('updateGameState', {
                        gameOver: checkGameOver(player1Deck),
                        winner: checkWinner(player1Deck, 'Player 1'),
                        playedCardsPile: [...playedCardsPile.slice(0, playedCardsPile.length), played_card, ...playedCardsPile.slice(playedCardsPile.length)],
                        player1Deck: [...player1Deck.slice(0, removeIndex), ...player1Deck.slice(removeIndex + 1)],
                        player2Deck: [...player2Deck.slice(0, player2Deck.length), drawCard1, drawCard2, drawCard3, drawCard4, ...player2Deck.slice(player2Deck.length)],
                        currentColor: newColor,
                        currentNumber: 600,
                        drawCardPile: [...copiedDrawCardPileArray]
                    });
                }
            }
            else{
                const newColor = prompt('Enter first letter of new color (R/G/B/Y)').toUpperCase();
                const removeIndex = player2Deck.indexOf(played_card);
                const copiedDrawCardPileArray = [...drawCardPile];
                const drawCard1 = copiedDrawCardPileArray.pop();
                const drawCard2 = copiedDrawCardPileArray.pop();
                const drawCard3 = copiedDrawCardPileArray.pop();
                const drawCard4 = copiedDrawCardPileArray.pop();

                //?
                socket.emit('updateGameState', {
                    gameOver: checkGameOver(player2Deck),
                    winner: checkWinner(player2Deck, 'Player 2'),
                    playedCardsPile: [...playedCardsPile.slice(0, playedCardsPile.length), played_card, ...playedCardsPile.slice(playedCardsPile.length)],
                    player2Deck: [...player2Deck.slice(0, removeIndex), ...player2Deck.slice(removeIndex + 1)],
                    player1Deck: [...player1Deck.slice(0, player1Deck.length), drawCard1, drawCard2, drawCard3, drawCard4, ...player1Deck.slice(player1Deck.length)],
                    currentColor: newColor,
                    currentNumber: 600,
                    drawCardPile: [...copiedDrawCardPileArray]
                })

                if(player2Deck.length === 2 && !isUnoButtonPressed){
                    alert('You forgot to press UNO. You drew 2 cards as penalty.');
                    const drawCard1X = copiedDrawCardPileArray.pop();
                    const drawCard2X = copiedDrawCardPileArray.pop();
                    const updatedPlayer2Deck = [...player2Deck.slice(0, removeIndex), ...player2Deck.slice(removeIndex+1)];
                    updatedPlayer2Deck.push(drawCard1X);
                    updatedPlayer2Deck.push(drawCard2X);
                    socket.emit('updateGameState', {
                        gameOver: checkGameOver(player2Deck),
                        winner: checkWinner(player2Deck, 'Player 2'),
                        playedCardsPile: [...playedCardsPile.slice(0, playedCardsPile.length), played_card, ...playedCardsPile.slice(playedCardsPile.length)],
                        player2Deck: [...updatedPlayer2Deck],
                        player1Deck: [...player1Deck.slice(0, player1Deck.length), drawCard1, drawCard2, drawCard3, drawCard4, ...player1Deck.slice(player1Deck.length)],
                        currentColor: newColor,
                        currentNumber: 600,
                        drawCardPile: [...copiedDrawCardPileArray]
                    });
                }
                else{
                    socket.emit('updateGameState', {
                        gameOver: checkGameOver(player2Deck),
                        winner: checkWinner(player2Deck, 'Player 2'),
                        playedCardsPile: [...playedCardsPile.slice(0, playedCardsPile.length), played_card, ...playedCardsPile.slice(playedCardsPile.length)],
                        player2Deck: [...player2Deck.slice(0, removeIndex), ...player2Deck.slice(removeIndex + 1)],
                        player1Deck: [...player1Deck.slice(0, player1Deck.length), drawCard1, drawCard2, drawCard3, drawCard4, ...player1Deck.slice(player1Deck.length)],
                        currentColor: newColor,
                        currentNumber: 600,
                        drawCardPile: [...copiedDrawCardPileArray]
                    });
                }
            }
        }
    }

    const onCardDrawnHandler = () => {
        if(turn === 'Player 1'){
            const copiedDrawCardPileArray = [...drawCardPile];
            const drawCard = copiedDrawCardPileArray.pop();
            const colorOfDrawnCard = drawCard.charAt(drawCard.length-1);
            const numberOfDrawnCard = drawCard.charAt(0);
            if(colorOfDrawnCard === currentColor && drawCard.length === 5){
                alert(`You drew ${drawCard}. It was played for you.`);
                socket.emit('updateGameState', {
                    playedCardsPile: [...playedCardsPile.slice(0, playedCardsPile.length), drawCard, ...playedCardsPile.slice(playedCardsPile.length)],
                    currentColor: colorOfDrawnCard,
                    currentNumber: 404,
                    drawCardPile: [...copiedDrawCardPileArray]
                });
            }
            else if(colorOfDrawnCard === currentColor && drawCard.charAt(1) === '2'){
                alert(`You drew ${drawCard}. It was played for you.`);
                const copiedDrawCardPileArray = [...drawCardPile];
                const drawCard1 = copiedDrawCardPileArray.pop();
                const drawCard2 = copiedDrawCardPileArray.pop();
                socket.emit('updateGameState', {
                    playedCardsPile: [...playedCardsPile.slice(0, playedCardsPile.length), drawCard, ...playedCardsPile.slice(playedCardsPile.length)],
                    player2Deck: [...player2Deck.slice(0, player2Deck.length), drawCard1, drawCard2, ...player2Deck.slice(player2Deck.length)],
                    currentColor: colorOfDrawnCard,
                    currentNumber: 252,
                    drawCardPile: [...copiedDrawCardPileArray]
                });
            }
            else if(drawCard === 'W'){
                alert(`You drew ${drawCard}. It was played for you.`);
                const newColor = prompt('Enter first letter of new color (R/G/B/Y)').toUpperCase();
                socket.emit('updateGameState', {
                    turn: 'Player 2',
                    playedCardsPile: [...playedCardsPile.slice(0, playedCardsPile.length), drawCard, ...playedCardsPile.slice(playedCardsPile.length)],
                    currentColor: newColor,
                    currentNumber: 300,
                    drawCardPile: [...copiedDrawCardPileArray]
                });
            }
            else if(drawCard === 'D4W'){
                alert(`You drew ${drawCard}. It was played for you.`);
                const newColor = prompt('Enter first letter of new color (R/G/B/Y)').toUpperCase();
                const copiedDrawCardPileArray = [...drawCardPile];
                const drawCard1 = copiedDrawCardPileArray.pop();
                const drawCard2 = copiedDrawCardPileArray.pop();
                const drawCard3 = copiedDrawCardPileArray.pop();
                const drawCard4 = copiedDrawCardPileArray.pop();
                socket.emit('updateGameState', {
                    playedCardsPile: [...playedCardsPile.slice(0, playedCardsPile.length), drawCard, ...playedCardsPile.slice(playedCardsPile.length)],
                    player2Deck: [...player2Deck.slice(0, player2Deck.length), drawCard1, drawCard2, drawCard3, drawCard4, ...player2Deck.slice(player2Deck.length)],
                    currentColor: newColor,
                    currentNumber: 600,
                    drawCardPile: [...copiedDrawCardPileArray]
                });
            }
            else if(numberOfDrawnCard === currentNumber || colorOfDrawnCard === currentColor){
                alert(`You drew ${drawCard}. It was played for you.`);
                socket.emit('updateGameState', {
                    turn: 'Player 2',
                    playedCardsPile: [...playedCardsPile.slice(0, playedCardsPile.length), drawCard, ...playedCardsPile.slice(playedCardsPile.length)],
                    currentColor: colorOfDrawnCard,
                    currentNumber: numberOfDrawnCard,
                    drawCardPile: [...copiedDrawCardPileArray]
                });
            }
            else{
                socket.emit('updateGameState', {
                    turn: 'Player 2',
                    player1Deck: [...player1Deck.slice(0, player1Deck.length), drawCard, ...player1Deck.slice(player1Deck.length)],
                    drawCardPile: [...copiedDrawCardPileArray]
                });
            }
        }
        else{
            const copiedDrawCardPileArray = [...drawCardPile];
            const drawCard = copiedDrawCardPileArray.pop();
            const colorOfDrawnCard = drawCard.charAt(drawCard.length-1);
            const numberOfDrawnCard = drawCard.charAt(0);
            if(colorOfDrawnCard === currentColor && drawCard.length === 5){
                alert(`You drew ${drawCard}. It was played for you.`);
                socket.emit('updateGameState', {
                    playedCardsPile: [...playedCardsPile.slice(0, playedCardsPile.length), drawCard, ...playedCardsPile.slice(playedCardsPile.length)],
                    currentColor: colorOfDrawnCard,
                    currentNumber: 404,
                    drawCardPile: [...copiedDrawCardPileArray]
                });
            }
            else if(colorOfDrawnCard === currentColor && drawCard.charAt(1) === '2'){
                alert(`You drew ${drawCard}. It was played for you.`);
                const copiedDrawCardPileArray = [...drawCardPile];
                const drawCard1 = copiedDrawCardPileArray.pop();
                const drawCard2 = copiedDrawCardPileArray.pop();
                socket.emit('updateGameState', {
                    playedCardsPile: [...playedCardsPile.slice(0, playedCardsPile.length), drawCard, ...playedCardsPile.slice(playedCardsPile.length)],
                    player1Deck: [...player1Deck.slice(0, player1Deck.length), drawCard1, drawCard2, ...player1Deck.slice(player1Deck.length)],
                    currentColor: colorOfDrawnCard,
                    currentNumber: 252,
                    drawCardPile: [...copiedDrawCardPileArray]
                });
            }
            else if(drawCard === 'W'){
                alert(`You drew ${drawCard}. It was played for you.`);
                const newColor = prompt('Enter first letter of new color (R/G/B/Y)').toUpperCase();
                socket.emit('updateGameState', {
                    turn: 'Player 1',
                    playedCardsPile: [...playedCardsPile.slice(0, playedCardsPile.length), drawCard, ...playedCardsPile.slice(playedCardsPile.length)],
                    currentColor: newColor,
                    currentNumber: 300,
                    drawCardPile: [...copiedDrawCardPileArray]
                });
            }
            else if(drawCard === 'D4W'){
                alert(`You drew ${drawCard}. It was played for you.`);
                const newColor = prompt('Enter first letter of new color (R/G/B/Y)').toUpperCase();
                const copiedDrawCardPileArray = [...drawCardPile];
                const drawCard1 = copiedDrawCardPileArray.pop();
                const drawCard2 = copiedDrawCardPileArray.pop();
                const drawCard3 = copiedDrawCardPileArray.pop();
                const drawCard4 = copiedDrawCardPileArray.pop();
                socket.emit('updateGameState', {
                    playedCardsPile: [...playedCardsPile.slice(0, playedCardsPile.length), drawCard, ...playedCardsPile.slice(playedCardsPile.length)],
                    player1Deck: [...player1Deck.slice(0, player1Deck.length), drawCard1, drawCard2, drawCard3, drawCard4, ...player1Deck.slice(player1Deck.length)],
                    currentColor: newColor,
                    currentNumber: 600,
                    drawCardPile: [...copiedDrawCardPileArray]
                });
            }
            else if(numberOfDrawnCard === currentNumber || colorOfDrawnCard === currentColor){
                alert(`You drew ${drawCard}. It was played for you.`);
                socket.emit('updateGameState', {
                    turn: 'Player 1',
                    playedCardsPile: [...playedCardsPile.slice(0, playedCardsPile.length), drawCard, ...playedCardsPile.slice(playedCardsPile.length)],
                    currentColor: colorOfDrawnCard,
                    currentNumber: numberOfDrawnCard,
                    drawCardPile: [...copiedDrawCardPileArray]
                });
            }
            else{
                socket.emit('updateGameState', {
                    turn: 'Player 1',
                    player2Deck: [...player2Deck.slice(0, player2Deck.length), drawCard, ...player2Deck.slice(player2Deck.length)],
                    drawCardPile: [...copiedDrawCardPileArray]
                });
            }
        }
    }

    const handleGameOver = async () => {
        setStats(prevStats => {
            const updatedStats = {
                gamesPlayed: Number(prevStats.gamesPlayed)+1,
                gamesWon: winner === currentUser ? Number(prevStats.gamesWon) + 1 : prevStats.gamesWon
            };
            return updatedStats;
        });
    };

    const handleQuit = async () => {
        await handleGameOver();
        await updateStats(username, stats.gamesPlayed, stats.gamesWon);
        console.log(winner, currentUser);
        localStorage.setItem('isAuthenticated', true);
        history('/');
    }

    const updateStats = async (username, gamesPlayed, gamesWon) => {
        try {
            const token = localStorage.getItem('token');
            await axios.put('wss://uno-online-5uml.onrender.com/updateStats', { username, gamesPlayed, gamesWon }, { headers: { Authorization: `Bearer ${token}` } });
            console.log('User stats updated successfully');
        } catch (error) {
            console.error('Error updating user stats:', error.message);
        }
    };


    return(
        <div className={`Game backgroundColorR backgroundColor${currentColor}`}>
            {(!roomFull) ? <>

                <div className='topInfo'>
                    <img src='assets/logo.png' alt=""/>
                    <h1>Game Code: {room}</h1>
                </div>

                {users.length===1 && currentUser === 'Player 2' && <h1 className='topInfoText'>Player 1 has left the game.</h1> }
                {users.length===1 && currentUser === 'Player 1' && <h1 className='topInfoText'>Waiting for Player 2 to join the game.</h1> }

                {users.length===2 && <>

                    {gameOver ? <div>{
                        winner !== '' && <><h1>GAME OVER</h1><h2>{winner} wins!</h2></>}
                    </div> :
                        <div>
                            {currentUser === 'Player 1' && <>
                                <div className='player2Deck' style={{pointerEvents: 'none'}}>
                                    <p className='playerDeckText'>Player 2</p>
                                    {player2Deck.map((item, i) => (
                                        <img
                                            key={i}
                                            className='Card'
                                            onClick={() => onCardPlayedHandler(item)}
                                            src='assets/card-back.png'
                                            alt=""
                                        />
                                    ))}
                                    {turn==='Player 2' && <Spinner />}
                                </div>
                                <br />
                                <div className='middleInfo' style={turn === 'Player 2' ? {pointerEvents: 'none'} : null}>
                                    <button className='game-button' disabled={turn !== 'Player 1'} onClick={onCardDrawnHandler}>DRAW CARD</button>
                                    {playedCardsPile && playedCardsPile.length>0 &&
                                        <img
                                            className='Card'
                                            src= {`./assets/cards-front/${playedCardsPile[playedCardsPile.length-1]}.png`}
                                            alt=""
                                        /> }
                                    <button className='game-button orange' disabled={player1Deck.length !== 2} onClick={() => {
                                        setUnoButtonPressed(!isUnoButtonPressed)
                                    }}>UNO</button>
                                </div>
                                <br />
                                <div className='player1Deck' style={turn === 'Player 1' ? null : {pointerEvents: 'none'}}>
                                    <p className='playerDeckText'>Player 1</p>
                                    {player1Deck.map((item, i) => (
                                        <img
                                            key={i}
                                            className='Card'
                                            onClick={() => onCardPlayedHandler(item)}
                                            src={`./assets/cards-front/${item}.png`}
                                            alt=""
                                        />
                                    ))}
                                </div>

                                <div className="chatBoxWrapper">
                                    <div className="chat-box chat-box-player1">
                                        <div className="chat-head">
                                            <h2>Chat Box</h2>
                                            {!isChatBoxHidden ?
                                                <span onClick={toggleChatBox} className="material-icons">keyboard_arrow_down</span> :
                                                <span onClick={toggleChatBox} className="material-icons">keyboard_arrow_up</span>}
                                        </div>
                                        <div className="chat-body">
                                            <div className="msg-insert">
                                                {messages.map(msg => {
                                                    if(msg.user === 'Player 2')
                                                        return <div className="msg-receive">{msg.text}</div>
                                                    if(msg.user === 'Player 1')
                                                        return <div className="msg-send">{msg.text}</div>
                                                })}
                                            </div>
                                            <div className="chat-text">
                                                <input type='text' placeholder='Type a message...' value={message} onChange={event => setMessage(event.target.value)} onKeyPress={event => event.key==='Enter' && sendMessage(event)} />
                                            </div>
                                        </div>
                                    </div>
                                </div> </> }

                            {currentUser === 'Player 2' && <>
                                <div className='player1Deck' style={{pointerEvents: 'none'}}>
                                    <p className='playerDeckText'>Player 1</p>
                                    {player1Deck.map((item, i) => (
                                        <img
                                            key={i}
                                            className='Card'
                                            onClick={() => onCardPlayedHandler(item)}
                                            src='assets/card-back.png'
                                            alt=""
                                        />
                                    ))}
                                    {turn==='Player 1' && <Spinner />}
                                </div>
                                <br />
                                <div className='middleInfo' style={turn === 'Player 1' ? {pointerEvents: 'none'} : null}>
                                    <button className='game-button' disabled={turn !== 'Player 2'} onClick={onCardDrawnHandler}>DRAW CARD</button>
                                    {playedCardsPile && playedCardsPile.length>0 &&
                                        <img
                                            className='Card'
                                            src={`./assets/cards-front/${playedCardsPile[playedCardsPile.length-1]}.png`}
                                            alt=""
                                        /> }
                                    <button className='game-button orange' disabled={player2Deck.length !== 2} onClick={() => {
                                        setUnoButtonPressed(!isUnoButtonPressed)
                                    }}>UNO</button>
                                </div>
                                <br />
                                <div className='player2Deck' style={turn === 'Player 1' ? {pointerEvents: 'none'} : null}>
                                    <p className='playerDeckText'>Player 2</p>
                                    {player2Deck.map((item, i) => (
                                        <img
                                            key={i}
                                            className='Card'
                                            onClick={() => onCardPlayedHandler(item)}
                                            src={`./assets/cards-front/${item}.png`}
                                            alt=""
                                        />
                                    ))}
                                </div>

                                <div className="chatBoxWrapper">
                                    <div className="chat-box chat-box-player2">
                                        <div className="chat-head">
                                            <h2>Chat Box</h2>
                                            {!isChatBoxHidden ?
                                                <span onClick={toggleChatBox} className="material-icons">keyboard_arrow_down</span> :
                                                <span onClick={toggleChatBox} className="material-icons">keyboard_arrow_up</span>}
                                        </div>
                                        <div className="chat-body">
                                            <div className="msg-insert">
                                                {messages.map(msg => {
                                                    if(msg.user === 'Player 1')
                                                        return <div className="msg-receive">{msg.text}</div>
                                                    if(msg.user === 'Player 2')
                                                        return <div className="msg-send">{msg.text}</div>
                                                })}
                                            </div>
                                            <div className="chat-text">
                                                <input type='text' placeholder='Type a message...' value={message} onChange={event => setMessage(event.target.value)} onKeyPress={event => event.key==='Enter' && sendMessage(event)} />
                                            </div>
                                        </div>
                                    </div>
                                </div> </> }
                        </div> }
                </> }
            </> : <h1>Room full</h1> }

            <br />
            <button className="game-button red" onClick={handleQuit}>QUIT</button>
        </div>
    )
}

export default Game;