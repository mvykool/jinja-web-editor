import { BrowserRouter as Router, Routes, Route, Link } from 'react-router-dom';
import Basic from './Basic';
import Advanced from './Advanced';

function App() {
  return (
    <Router>
      <div className="min-h-screen bg-gray-900 ">
        <nav className="bg-gray-800 p-4 border-b border-white">
          <div className=" mx-auto flex justify-between items-center">
            <h1 className="text-xl font-bold text-white">Jinja Editor</h1>
            <div className="space-x-4">
              <Link to="/" className="text-gray-300 hover:text-white px-3 py-2 rounded-md text-sm font-medium">
                Basic
              </Link>
              <Link to="/advanced" className="text-gray-300 hover:text-white px-3 py-2 rounded-md text-sm font-medium">
                Advanced
              </Link>
            </div>
          </div>
        </nav>
        
        <Routes>
          <Route path="/" element={<Basic />} />
          <Route path="/advanced" element={<Advanced />} />
        </Routes>
      </div>
    </Router>
  );
}

export default App;
