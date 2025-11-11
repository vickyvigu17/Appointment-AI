import React from 'react';
import './MessageBubble.css';

function MessageBubble({ message, onAlternative }) {
  const getMessageClass = () => {
    if (message.type === 'user') return 'user';
    if (message.type === 'system') return 'system';
    if (message.type === 'error') return 'error';
    if (message.responseType === 'success') return 'success';
    if (message.responseType === 'suggestion') return 'suggestion';
    return 'assistant';
  };

  return (
    <div className={`message ${getMessageClass()}`}>
      <div className="message-content">
        <p>{message.text}</p>
        {message.alternative && (
          <button
            className="alternative-button"
            onClick={() => onAlternative(message.alternative)}
          >
            Book Alternative Slot
          </button>
        )}
      </div>
      <span className="message-time">
        {message.timestamp.toLocaleTimeString()}
      </span>
    </div>
  );
}

export default MessageBubble;




