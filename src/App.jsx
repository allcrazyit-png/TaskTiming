import { HashRouter as Router, Routes, Route } from 'react-router-dom';
import Home from './pages/Home';
import Input from './pages/Input';
import Confirm from './pages/Confirm';
import BattleReport from './pages/BattleReport';
import ManualWork from './pages/ManualWork';

function App() {
  return (
    <Router>
      <Routes>
        <Route path="/" element={<Home />} />
        <Route path="/manual-work" element={<ManualWork />} />
        <Route path="/input" element={<Input />} />
        <Route path="/confirm" element={<Confirm />} />
        <Route path="/battle" element={<BattleReport />} />
      </Routes>
    </Router>
  );
}

export default App;
