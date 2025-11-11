import axios from 'axios';

const API_BASE_URL = process.env.REACT_APP_API_URL || 'http://localhost:3001/api';

export const api = {
  // Chat with LLM
  sendMessage: async (message, vendorName, vendorEmail) => {
    const response = await axios.post(`${API_BASE_URL}/appointments/chat`, {
      message,
      vendor_name: vendorName,
      vendor_email: vendorEmail
    });
    return response.data;
  },

  // Get slots for a date
  getSlots: async (date) => {
    const response = await axios.get(`${API_BASE_URL}/slots`, {
      params: { date }
    });
    return response.data;
  },

  // Get user appointments
  getMyAppointments: async (vendorEmail) => {
    const response = await axios.get(`${API_BASE_URL}/appointments/my-appointments`, {
      params: { vendor_email: vendorEmail }
    });
    return response.data;
  }
};




