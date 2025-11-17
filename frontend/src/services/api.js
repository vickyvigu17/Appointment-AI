import axios from 'axios';

const API_BASE_URL = process.env.REACT_APP_API_URL || 'http://localhost:3001/api';

export const api = {
  // Chat with LLM
  sendMessage: async (message, vendorName, vendorEmail, carrierName = null) => {
    try {
      const response = await axios.post(`${API_BASE_URL}/appointments/chat`, {
        message,
        vendor_name: vendorName,
        vendor_email: vendorEmail,
        carrier_name: carrierName
      });
      return response.data;
    } catch (error) {
      // Handle axios errors with better error messages
      if (error.response) {
        // Server responded with error status
        const errorData = error.response.data;
        const errorMessage = errorData?.message || errorData?.error || 'An error occurred';
        const apiError = new Error(errorMessage);
        apiError.response = error.response;
        apiError.data = errorData;
        throw apiError;
      } else if (error.request) {
        // Request was made but no response received
        throw new Error('Network error: Could not reach the server. Please check your connection.');
      } else {
        // Something else happened
        throw new Error(error.message || 'An unexpected error occurred');
      }
    }
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








