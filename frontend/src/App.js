import React, { useState } from 'react';
import ChatInterface from './components/ChatInterface';
import CalendarView from './components/CalendarView';
import { format } from 'date-fns';
import './App.css';

function App() {
  const [vendorInfo, setVendorInfo] = useState({ name: '', email: '' });
  const [selectedDate, setSelectedDate] = useState(format(new Date(), 'yyyy-MM-dd'));
  const [refreshTrigger, setRefreshTrigger] = useState(0);

  const handleVendorInfoUpdate = (info) => {
    if (info.name && info.email) {
      setVendorInfo(info);
    } else {
      setVendorInfo(prev => ({ ...prev, ...info }));
    }
  };

  const handleAppointmentUpdate = () => {
    setRefreshTrigger(prev => prev + 1);
  };

  return (
    <div className="app">
      <header className="app-header">
        <h1>🤖 AI Appointment Booking System</h1>
        <p>DC Inbound Appointments</p>
      </header>
      <div className="app-container">
        <div className="chat-section">
          <ChatInterface
            vendorInfo={vendorInfo}
            onAppointmentUpdate={handleAppointmentUpdate}
          />
        </div>
        <div className="calendar-section">
          <input
            type="date"
            value={selectedDate}
            onChange={(e) => setSelectedDate(e.target.value)}
            className="date-picker"
          />
          <CalendarView
            selectedDate={selectedDate}
            onDateSelect={setSelectedDate}
            refreshTrigger={refreshTrigger}
          />
        </div>
      </div>
    </div>
  );
}

export default App;

