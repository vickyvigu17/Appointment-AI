import React, { useState, useEffect } from 'react';
import { format } from 'date-fns';
import { api } from '../services/api';
import './CalendarView.css';

function CalendarView({ selectedDate, onDateSelect, refreshTrigger }) {
  const [slots, setSlots] = useState([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (selectedDate) {
      loadSlots(selectedDate);
    }
  }, [selectedDate, refreshTrigger]);

  const loadSlots = async (date) => {
    setLoading(true);
    try {
      const response = await api.getSlots(date);
      setSlots(response.slots || []);
    } catch (error) {
      console.error('Failed to load slots:', error);
    } finally {
      setLoading(false);
    }
  };

  const getSlotClass = (slot) => {
    if (slot.isBlocked) return 'blocked';
    if (!slot.available) return 'full';
    if (slot.liveCount > 0 || slot.dropCount > 0) return 'booked';
    return 'available';
  };

  const getSlotLabel = (slot) => {
    if (slot.isBlocked) return 'Blocked';
    if (slot.liveCount > 0 && slot.dropCount > 0) return `L:${slot.liveCount} D:${slot.dropCount}`;
    if (slot.liveCount > 0) return `Live: ${slot.liveCount}`;
    if (slot.dropCount > 0) return `Drop: ${slot.dropCount}`;
    return 'Available';
  };

  return (
    <div className="calendar-view">
      <h3>Slots for {selectedDate ? format(new Date(selectedDate), 'MMMM d, yyyy') : 'Select a date'}</h3>
      {loading ? (
        <div className="loading">Loading slots...</div>
      ) : (
        <div className="slots-grid">
          {slots.map((slot) => (
            <div
              key={slot.hour}
              className={`slot ${getSlotClass(slot)}`}
              title={slot.blockedReason || getSlotLabel(slot)}
            >
              <div className="slot-hour">{slot.hour}:00</div>
              <div className="slot-status">{getSlotLabel(slot)}</div>
            </div>
          ))}
        </div>
      )}
      <div className="legend">
        <div className="legend-item">
          <span className="legend-color available"></span>
          <span>Available</span>
        </div>
        <div className="legend-item">
          <span className="legend-color booked"></span>
          <span>Booked</span>
        </div>
        <div className="legend-item">
          <span className="legend-color full"></span>
          <span>Full</span>
        </div>
        <div className="legend-item">
          <span className="legend-color blocked"></span>
          <span>Blocked</span>
        </div>
      </div>
    </div>
  );
}

export default CalendarView;




