import React, { useState, useEffect, useRef } from 'react';
import { api } from '../services/api';
import MessageBubble from './MessageBubble';
import './ChatInterface.css';

function ChatInterface({ vendorInfo, onVendorInfoUpdate, onAppointmentUpdate }) {
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const messagesEndRef = useRef(null);

  useEffect(() => {
    if (!vendorInfo.name || !vendorInfo.email) {
      setMessages([{
        type: 'system',
        text: '👋 Welcome! Please provide your vendor name and email to get started.',
        timestamp: new Date()
      }]);
    } else {
      setMessages([{
        type: 'system',
        text: `Hello ${vendorInfo.name}! How can I help you book, reschedule, or cancel an appointment?`,
        timestamp: new Date()
      }]);
    }
  }, [vendorInfo]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const handleSend = async () => {
    if (!input.trim() || loading) return;

    if (!vendorInfo.name || !vendorInfo.email) {
      // Extract vendor info from message - more flexible patterns
      const emailMatch = input.match(/[\w.-]+@[\w.-]+\.[\w]+/);
      
      // Try multiple name patterns
      let nameMatch = input.match(/(?:name is|i am|i'm|my name is)\s+([A-Za-z\s]+?)(?:\s+and|\s+email|$)/i);
      if (!nameMatch) {
        nameMatch = input.match(/(?:name:)\s*([A-Za-z\s]+?)(?:\s+email|$)/i);
      }
      if (!nameMatch) {
        // Try to extract name before email
        const beforeEmail = input.split('@')[0];
        if (beforeEmail) {
          const parts = beforeEmail.match(/([A-Za-z\s]+)/);
          if (parts) nameMatch = [null, parts[1].trim()];
        }
      }
      
      if (emailMatch) {
        const name = nameMatch ? nameMatch[1].trim() : 'User';
        onVendorInfoUpdate({
          name: name,
          email: emailMatch[0]
        });
        setMessages(prev => [...prev, {
          type: 'user',
          text: input,
          timestamp: new Date()
        }, {
          type: 'system',
          text: `✅ Welcome ${name}! How can I help you book, reschedule, or cancel an appointment?`,
          timestamp: new Date()
        }]);
        setInput('');
        return;
      } else {
        setMessages(prev => [...prev, {
          type: 'user',
          text: input,
          timestamp: new Date()
        }, {
          type: 'system',
          text: 'Please provide your name and email. Example: "My name is John Doe and email is john@example.com"',
          timestamp: new Date()
        }]);
        setInput('');
        return;
      }
    }

    const userMessage = {
      type: 'user',
      text: input,
      timestamp: new Date()
    };

    setMessages(prev => [...prev, userMessage]);
    setInput('');
    setLoading(true);

    try {
      const response = await api.sendMessage(
        input,
        vendorInfo.name,
        vendorInfo.email
      );

      const assistantMessage = {
        type: 'assistant',
        text: response.message,
        responseType: response.type,
        data: response.data,
        alternative: response.alternative,
        timestamp: new Date()
      };

      setMessages(prev => [...prev, assistantMessage]);

      // Trigger calendar refresh if appointment was created/updated/deleted
      if (response.type === 'success') {
        onAppointmentUpdate();
      }
    } catch (error) {
      console.error('Chat error:', error);
      // Extract error message from various possible locations
      let errorMessage = 'Failed to send message. Please try again.';
      
      if (error.message) {
        errorMessage = error.message;
      } else if (error.response?.data?.message) {
        errorMessage = error.response.data.message;
      } else if (error.response?.data?.error) {
        errorMessage = error.response.data.error;
      } else if (error.data?.message) {
        errorMessage = error.data.message;
      }
      
      setMessages(prev => [...prev, {
        type: 'error',
        text: errorMessage,
        timestamp: new Date()
      }]);
    } finally {
      setLoading(false);
    }
  };

  const handleAlternative = async (alternative) => {
    setInput(`Yes, book ${alternative.type} appointment on ${alternative.date} at ${alternative.hour}:00`);
    handleSend();
  };

  return (
    <div className="chat-interface">
      <div className="chat-messages">
        {messages.map((msg, idx) => (
          <MessageBubble
            key={idx}
            message={msg}
            onAlternative={handleAlternative}
          />
        ))}
        {loading && (
          <div className="message assistant loading">
            <div className="typing-indicator">
              <span></span><span></span><span></span>
            </div>
          </div>
        )}
        <div ref={messagesEndRef} />
      </div>
      <div className="chat-input">
        <input
          type="text"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyPress={(e) => e.key === 'Enter' && handleSend()}
          placeholder="Type your message..."
          disabled={loading}
        />
        <button onClick={handleSend} disabled={loading || !input.trim()}>
          Send
        </button>
      </div>
    </div>
  );
}

export default ChatInterface;

