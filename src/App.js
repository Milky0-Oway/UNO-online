import './App.css';
import { BrowserRouter, Route, Routes } from 'react-router-dom';
import Homepage from './components/Homepage';
import Game from './components/Game';

function App() {
    return (
        <div className="App">
            <BrowserRouter>
                <Routes>
                    <Route path='/' element={<Homepage />} />
                    <Route path='/play' element={<Game />} />
                </Routes>
            </BrowserRouter>
        </div>
    );
}

export default App;
