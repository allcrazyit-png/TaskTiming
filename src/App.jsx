import { HashRouter as Router, Routes, Route } from 'react-router-dom';
import Home from './pages/Home';
import Input from './pages/Input';
import Confirm from './pages/Confirm';

function App() {
  return (
    <Router>
      <Routes>
        <Route path="/" element={<Home />} />
        <Route path="/input" element={<Input />} />
        <Route path="/confirm" element={<Confirm />} />
      </Routes>
    </Router>
  );
}

export default App;
