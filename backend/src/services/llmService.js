import OpenAI from 'openai';
import { getISTDate, getDateString, formatDateForDisplay } from '../utils/dateUtils.js';
import * as appointmentService from './appointmentService.js';

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY
});

// System prompt for LLM
function getSystemPrompt() {
  const now = getISTDate();
  return `You are an AI assistant for a Distribution Center (DC) appointment booking system.

Your role:
1. Understand user's natural language requests for booking, rescheduling, or canceling appointments
2. Extract structured information and convert it to JSON format
3. Handle ambiguous requests by asking clarifying questions
4. When slots are unavailable, suggest alternatives

Appointment Types:
- "live": Live appointment (max 1 per slot)
- "drop": Drop-off appointment (max 10 per slot)

Current Date/Time (IST): ${getDateString(now)} ${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}

When user provides a request:
1. If the request is clear and complete, respond with JSON only:
   {
     "action": "create" | "update" | "delete" | "query",
     "date": "YYYY-MM-DD",
     "hour": 0-23,
     "type": "live" | "drop",
     "vendor_name": "string",
     "vendor_email": "string",
     "appointment_id": "uuid (for update/delete)",
     "query_type": "my_appointments" | "availability" (for query action)
   }

2. If the request is ambiguous or missing information, ask a clarifying question in natural language.

3. For date references:
   - "today" = ${getDateString(now)}
   - "tomorrow" = ${getDateString(new Date(now.getTime() + 24 * 60 * 60 * 1000))}
   - Convert relative dates to YYYY-MM-DD format

4. For time references:
   - "8 AM" = hour 8
   - "2 PM" = hour 14
   - "midnight" = hour 0
   - "noon" = hour 12

5. When action is "query", you're asking about availability or user's appointments.

IMPORTANT: Only respond with JSON when you have ALL required fields. Otherwise, ask clarifying questions.`;
}

export async function processUserMessage(userMessage, conversationHistory, vendorInfo) {
  const messages = [
    { role: 'system', content: getSystemPrompt() },
    ...conversationHistory,
    { 
      role: 'user', 
      content: `Vendor Info: Name: ${vendorInfo.name}, Email: ${vendorInfo.email}\n\nUser Request: ${userMessage}` 
    }
  ];

  try {
    const completion = await openai.chat.completions.create({
      model: 'gpt-4', // or 'gpt-3.5-turbo' for faster/cheaper
      messages: messages,
      temperature: 0.3, // Lower temperature for more consistent structured output
      response_format: { type: 'json_object' } // Force JSON response
    });

    const response = completion.choices[0].message.content;
    let parsedResponse;

    try {
      parsedResponse = JSON.parse(response);
    } catch (e) {
      // If JSON parsing fails, treat as natural language response
      return {
        type: 'clarification',
        message: response
      };
    }

    // Check if it's a clarification question (no action field or action is not valid)
    if (!parsedResponse.action || !['create', 'update', 'delete', 'query'].includes(parsedResponse.action)) {
      return {
        type: 'clarification',
        message: response
      };
    }

    // If action is query, handle it differently
    if (parsedResponse.action === 'query') {
      return await handleQueryAction(parsedResponse, vendorInfo);
    }

    // Execute the action
    return await executeAction(parsedResponse, vendorInfo);

  } catch (error) {
    console.error('LLM Error:', error);
    return {
      type: 'error',
      message: 'I encountered an error processing your request. Please try again.'
    };
  }
}

async function executeAction(intent, vendorInfo) {
  try {
    let result;
    let message;

    switch (intent.action) {
      case 'create':
        result = await appointmentService.createAppointment({
          date: intent.date,
          hour: intent.hour,
          type: intent.type,
          vendor_name: vendorInfo.name,
          vendor_email: vendorInfo.email
        });
        message = `✅ Successfully booked a ${intent.type} appointment on ${formatDateForDisplay(intent.date)} at ${intent.hour}:00 IST.`;
        break;

      case 'update':
        if (!intent.appointment_id) {
          // Need to find the appointment first
          const appointments = await appointmentService.getUserAppointments(vendorInfo.email);
          if (appointments.length === 0) {
            return {
              type: 'error',
              message: 'You have no appointments to reschedule.'
            };
          }
          // Use the first appointment or ask user to specify
          intent.appointment_id = appointments[0].id;
        }
        result = await appointmentService.updateAppointment(
          intent.appointment_id,
          intent.date,
          intent.hour
        );
        message = `✅ Successfully rescheduled your appointment to ${formatDateForDisplay(intent.date)} at ${intent.hour}:00 IST.`;
        break;

      case 'delete':
        if (!intent.appointment_id) {
          const appointments = await appointmentService.getUserAppointments(vendorInfo.email);
          if (appointments.length === 0) {
            return {
              type: 'error',
              message: 'You have no appointments to cancel.'
            };
          }
          intent.appointment_id = appointments[0].id;
        }
        result = await appointmentService.deleteAppointment(intent.appointment_id);
        message = `✅ Successfully canceled your appointment.`;
        break;

      default:
        return {
          type: 'error',
          message: 'Unknown action. Please try again.'
        };
    }

    return {
      type: 'success',
      message: message,
      data: result
    };

  } catch (error) {
    // Handle business rule violations
    if (error.message.includes('blocked') || 
        error.message.includes('already has') || 
        error.message.includes('already has 10')) {
      
      // Find alternative slot
      const nextSlot = await appointmentService.findNextAvailableSlot(
        intent.date,
        intent.hour,
        intent.type
      );

      if (nextSlot !== null) {
        return {
          type: 'suggestion',
          message: `❌ ${error.message}\n\n💡 The next available slot is at ${nextSlot}:00. Would you like me to book that instead?`,
          alternative: {
            date: intent.date,
            hour: nextSlot,
            type: intent.type
          }
        };
      } else {
        return {
          type: 'error',
          message: `${error.message}\n\nUnfortunately, there are no more available slots for ${intent.type} appointments today. Would you like to try a different date?`
        };
      }
    }

    return {
      type: 'error',
      message: error.message
    };
  }
}

async function handleQueryAction(intent, vendorInfo) {
  try {
    if (intent.query_type === 'my_appointments') {
      const appointments = await appointmentService.getUserAppointments(vendorInfo.email);
      if (appointments.length === 0) {
        return {
          type: 'info',
          message: 'You have no upcoming appointments.'
        };
      }
      const list = appointments.map(apt => 
        `- ${formatDateForDisplay(apt.date)} at ${apt.hour}:00 (${apt.type})`
      ).join('\n');
      return {
        type: 'info',
        message: `Your appointments:\n${list}`
      };
    }

    if (intent.query_type === 'availability' && intent.date) {
      const slots = await appointmentService.getSlotsForDate(intent.date);
      const available = slots.filter(s => s.available && !s.isBlocked);
      if (available.length === 0) {
        return {
          type: 'info',
          message: `No available slots on ${formatDateForDisplay(intent.date)}.`
        };
      }
      const hours = available.map(s => `${s.hour}:00`).join(', ');
      return {
        type: 'info',
        message: `Available slots on ${formatDateForDisplay(intent.date)}: ${hours}`
      };
    }

    return {
      type: 'info',
      message: 'I can help you check your appointments or availability. What would you like to know?'
    };
  } catch (error) {
    return {
      type: 'error',
      message: error.message
    };
  }
}

// Export for evaluation logging
export function logLLMInteraction(userMessage, intent, response, executionResult) {
  const log = {
    timestamp: new Date().toISOString(),
    userMessage,
    extractedIntent: intent,
    llmResponse: response,
    executionResult,
    success: executionResult.type === 'success'
  };
  console.log('LLM_EVAL:', JSON.stringify(log, null, 2));
  // In production, save to database for analysis
}

