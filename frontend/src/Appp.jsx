import { BrowserRouter, Routes, Route } from 'react-router-dom'
import Navbar from './components/Navbar'
import Landing from './pages/Landing'
import Events from './pages/Events'
import BuyTicket from './pages/BuyTicket'
import MyTickets from './pages/MyTickets'
import Resale from './pages/Resale'
import SubmitEvent from './pages/SubmitEvent'
import Admin from './pages/Admin'
import './index.css'
import Scanner from './pages/Scanner'
import Transparency from './pages/Transparency'

function App() {
  return (
    <BrowserRouter>
      <Navbar />
      <main className="container">
        <Routes>
          <Route path="/"              element={<Landing />} />
          <Route path="/events"        element={<Events />} />
          <Route path="/buy/:eventId"  element={<BuyTicket />} />
          <Route path="/my-tickets"    element={<MyTickets />} />
          <Route path="/resale"        element={<Resale />} />
          <Route path="/submit-event"  element={<SubmitEvent />} />
          <Route path="/admin"         element={<Admin />} />
          <Route path="/scan" element={<Scanner />} />
          <Route path="/transparency" element={<Transparency />} />
        </Routes>
      </main>
    </BrowserRouter>
  )
}

export default App
