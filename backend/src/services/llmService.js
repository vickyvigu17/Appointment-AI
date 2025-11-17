import OpenAI from 'openai';
import { Langfuse } from 'langfuse';
import { addDays } from 'date-fns';
import { getISTDate, getDateString, formatDateForDisplay } from '../utils/dateUtils.js';
import * as appointmentService from './appointmentService.js';

// Lazy initialization of OpenAI client
let openai = null;
let langfuseInstance;

function getOpenAIClient() {
  if (!openai) {
    const apiKey = process.env.OPENAI_API_KEY;
    if (!apiKey) {
      throw new Error('OPENAI_API_KEY must be set in environment variables');
    }
    openai = new OpenAI({
      apiKey: apiKey
    });
  }
  return openai;
}

function getLangfuseClient() {
  if (typeof langfuseInstance === 'undefined') {
    const secretKey = process.env.LANGFUSE_SECRET_KEY;
    const publicKey = process.env.LANGFUSE_PUBLIC_KEY;

    if (secretKey && publicKey) {
      langfuseInstance = new Langfuse({
        secretKey,
        publicKey,
        baseUrl: process.env.LANGFUSE_BASE_URL,
        release: process.env.LANGFUSE_RELEASE || process.env.npm_package_version,
        environment: process.env.NODE_ENV || 'development'
      });
    } else {
      langfuseInstance = null;
    }
  }

  return langfuseInstance;
}

// System prompt for LLM
function getSystemPrompt(currentTime = getISTDate()) {
  const now = currentTime;
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
     "tracking_code": "8-digit string (required for update/delete)",
     "vendor_name": "string",
     "vendor_email": "string",
     "carrier_name": "string",
     "query_type": "my_appointments" | "availability" (for query action)
   }

Always confirm the carrier name (e.g., "MKTTC") before finalizing booking, update, or cancel actions.

CONTEXT AWARENESS - Follow-up Conversations:
- When user asks to "show my appointments" or "my appointments", you will receive a list of appointments with their details (shown as "Appointment ID" to users)
- In follow-up messages, if user refers to an appointment (e.g., "change that to 1pm", "reschedule the first one", "cancel the appointment on Tuesday"), you MUST extract the tracking_code from the conversation history
- Look for Appointment IDs (8-digit numbers) in previous assistant messages in the conversation history (they appear as "Appointment ID: XXXXXXXX")
- If user mentions a date/time from a previously shown appointment, match it to get the tracking_code
- For reschedule/update: If tracking_code is in conversation history, use it. Only ask for Appointment ID if it's truly not available in the conversation
- For delete/cancel: Same rule - extract tracking_code from conversation history when possible

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

function getFewShotExamples(currentTime = getISTDate()) {
  const now = currentTime;
  const tomorrow = new Date(now.getTime() + 24 * 60 * 60 * 1000);
  const inTwoDays = new Date(now.getTime() + 2 * 24 * 60 * 60 * 1000);
  const upcomingFriday = (() => {
    const date = new Date(now);
    const day = date.getDay();
    const diff = (5 - day + 7) % 7 || 7;
    date.setDate(date.getDate() + diff);
    return date;
  })();

  return [
    {
      role: 'user',
      content: `Vendor Info: Name: ABC Logistics, Email: abc@example.com, Carrier: ABC Carrier\n\nUser Request: Book a live appointment tomorrow at 8 AM`
    },
    {
      role: 'assistant',
      content: JSON.stringify({
        action: 'create',
        date: getDateString(tomorrow),
        hour: 8,
        type: 'live',
        vendor_name: 'ABC Logistics',
        vendor_email: 'abc@example.com',
        carrier_name: 'ABC Carrier'
      })
    },
    {
      role: 'user',
      content: `Vendor Info: Name: RGH, Email: rghteam@abc.com, Carrier: RGH Carrier\n\nUser Request: Schedule a drop at 3 PM on Friday`
    },
    {
      role: 'assistant',
      content: JSON.stringify({
        action: 'create',
        date: getDateString(upcomingFriday),
        hour: 15,
        type: 'drop',
        vendor_name: 'RGH',
        vendor_email: 'rghteam@abc.com',
        carrier_name: 'RGH Carrier'
      })
    },
    {
      role: 'user',
      content: `Vendor Info: Name: ABC Logistics, Email: abc@example.com, Carrier: ABC Carrier\n\nUser Request: Reschedule my live appointment to 5 PM the day after tomorrow`
    },
    {
      role: 'assistant',
      content: JSON.stringify({
        action: 'update',
        date: getDateString(inTwoDays),
        hour: 17,
        type: 'live',
        tracking_code: '12345678',
        vendor_name: 'ABC Logistics',
        vendor_email: 'abc@example.com',
        carrier_name: 'ABC Carrier'
      })
    },
    {
      role: 'user',
      content: `Vendor Info: Name: ABC Logistics, Email: abc@example.com, Carrier: ABC Carrier\n\nUser Request: Cancel my drop appointment tomorrow at 9 PM`
    },
    {
      role: 'assistant',
      content: JSON.stringify({
        action: 'delete',
        tracking_code: '87654321',
        vendor_name: 'ABC Logistics',
        vendor_email: 'abc@example.com',
        carrier_name: 'ABC Carrier'
      })
    },
    {
      role: 'user',
      content: `Vendor Info: Name: ABC Logistics, Email: abc@example.com, Carrier: ABC Carrier\n\nUser Request: Show my appointments`
    },
    {
      role: 'assistant',
      content: JSON.stringify({
        action: 'query',
        query_type: 'my_appointments',
        vendor_name: 'ABC Logistics',
        vendor_email: 'abc@example.com',
        carrier_name: 'ABC Carrier'
      })
    },
    {
      role: 'user',
      content: `Vendor Info: Name: ABC Logistics, Email: abc@example.com, Carrier: ABC Carrier\n\nUser Request: Show all appointments made by me`
    },
    {
      role: 'assistant',
      content: JSON.stringify({
        action: 'query',
        query_type: 'my_appointments',
        vendor_name: 'ABC Logistics',
        vendor_email: 'abc@example.com',
        carrier_name: 'ABC Carrier'
      })
    },
    {
      role: 'user',
      content: `Vendor Info: Name: ABC Logistics, Email: abc@example.com, Carrier: ABC Carrier\n\nUser Request: Book a live appointment tomorrow evening`
    },
    {
      role: 'assistant',
      content: JSON.stringify({
        message: 'Evening is ambiguous. Please specify the hour (0-23).'
      })
    },
    {
      role: 'user',
      content: `Vendor Info: Name: ABC Logistics, Email: abc@example.com, Carrier: ABC Carrier\n\nUser Request: Show my appointments`
    },
    {
      role: 'assistant',
      content: JSON.stringify({
        action: 'query',
        query_type: 'my_appointments',
        vendor_name: 'ABC Logistics',
        vendor_email: 'abc@example.com',
        carrier_name: 'ABC Carrier'
      })
    },
    {
      role: 'assistant',
      content: 'Your appointments:\n- Tuesday, November 18, 2025 at 10:00 (live) - Appointment ID: 30238322\n- Friday, November 21, 2025 at 15:00 (drop) - Appointment ID: 87654321'
    },
    {
      role: 'user',
      content: `Vendor Info: Name: ABC Logistics, Email: abc@example.com, Carrier: ABC Carrier\n\nUser Request: Change the first one to 1pm`
    },
    {
      role: 'assistant',
      content: JSON.stringify({
        action: 'update',
        date: '2025-11-18',
        hour: 13,
        type: 'live',
        tracking_code: '30238322',
        vendor_name: 'ABC Logistics',
        vendor_email: 'abc@example.com',
        carrier_name: 'ABC Carrier'
      })
    },
    {
      role: 'user',
      content: `Vendor Info: Name: ABC Logistics, Email: abc@example.com, Carrier: ABC Carrier\n\nUser Request: Reschedule the appointment on Tuesday to 2pm`
    },
    {
      role: 'assistant',
      content: JSON.stringify({
        action: 'update',
        date: '2025-11-18',
        hour: 14,
        type: 'live',
        tracking_code: '30238322',
        vendor_name: 'ABC Logistics',
        vendor_email: 'abc@example.com',
        carrier_name: 'ABC Carrier'
      })
    }
  ];
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
          vendor_email: vendorInfo.email,
          carrier_name: intent.carrier_name || vendorInfo.carrier_name
        });
        message = `✅ Successfully booked a ${intent.type} appointment on ${formatDateForDisplay(intent.date)} at ${intent.hour}:00 IST.`;
        break;

      case 'update':
        if (!intent.tracking_code) {
          return {
            type: 'clarification',
            message: 'Please provide the 8-digit Appointment ID so I can reschedule the correct appointment.'
          };
        }
        if (!intent.date || intent.hour === undefined || intent.hour === null) {
          return {
            type: 'clarification',
            message: 'To reschedule, let me know the new date (YYYY-MM-DD) and time (hour in 0-23).'
          };
        }
        result = await appointmentService.updateAppointmentByTrackingCode(
          intent.tracking_code,
          intent.date,
          intent.hour
        );
        message = `✅ Successfully rescheduled appointment ${intent.tracking_code} to ${formatDateForDisplay(intent.date)} at ${intent.hour}:00 IST.`;
        break;

      case 'delete':
        if (!intent.tracking_code) {
          return {
            type: 'clarification',
            message: 'Please share the 8-digit Appointment ID so I can cancel the right appointment.'
          };
        }
        result = await appointmentService.deleteAppointmentByTrackingCode(intent.tracking_code);
        message = `✅ Successfully canceled appointment ${intent.tracking_code}.`;
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
      // Include tracking codes in the response so LLM can reference them in follow-ups
      const list = appointments.map(apt => 
        `- ${formatDateForDisplay(apt.date)} at ${apt.hour}:00 (${apt.type}) - Appointment ID: ${apt.tracking_code}`
      ).join('\n');
      return {
        type: 'info',
        message: `Your appointments:\n${list}`,
        data: appointments // Include full appointment data for context
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

function detectAction(message) {
  const lower = message.toLowerCase();
  if (lower.includes('cancel')) return 'delete';
  if (
    lower.includes('resched') ||
    lower.includes('move') ||
    lower.includes('change') ||
    lower.includes('shift')
  ) {
    return 'update';
  }
  if (
    lower.includes('availability') ||
    lower.includes('available slot') ||
    lower.includes('free slot') ||
    lower.includes('open slot')
  ) {
    return 'query_availability';
  }
  if (
    lower.includes('my appointments') ||
    lower.includes('what appointments') ||
    lower.includes('upcoming appointments') ||
    lower.includes('appointments made by me') ||
    lower.includes('appointments i made')
  ) {
    return 'query_my';
  }
  if (
    lower.includes('book') ||
    lower.includes('schedule') ||
    lower.includes('need an appointment') ||
    lower.includes('create an appointment')
  ) {
    return 'create';
  }
  return null;
}

function parseAppointmentType(message) {
  const lower = message.toLowerCase();
  if (lower.includes('drop')) return 'drop';
  if (lower.includes('live')) return 'live';
  return null;
}

function getNextWeekdayDate(currentTime, targetDayIndex) {
  const currentDay = currentTime.getDay();
  let diff = (targetDayIndex - currentDay + 7) % 7;
  return addDays(currentTime, diff);
}

function parseDateFromMessage(message, currentTime) {
  const lower = message.toLowerCase();

  if (lower.includes('day after tomorrow')) {
    return getDateString(addDays(currentTime, 2));
  }

  if (lower.includes('tomorrow')) {
    return getDateString(addDays(currentTime, 1));
  }

  if (lower.includes('today')) {
    return getDateString(currentTime);
  }

  const isoMatch = message.match(/\b\d{4}-\d{2}-\d{2}\b/);
  if (isoMatch) {
    return isoMatch[0];
  }

  const months = [
    'january', 'february', 'march', 'april', 'may', 'june',
    'july', 'august', 'september', 'october', 'november', 'december'
  ];
  const monthRegex = new RegExp(`\\b(${months.join('|')})\\s+(\\d{1,2})(?:st|nd|rd|th)?(?:,\\s*(\\d{4}))?`, 'i');
  const monthMatch = message.match(monthRegex);
  if (monthMatch) {
    const [, monthName, dayStr, yearStr] = monthMatch;
    const monthIndex = months.indexOf(monthName.toLowerCase());
    const year = yearStr ? parseInt(yearStr, 10) : currentTime.getFullYear();
    const parsedDate = new Date(year, monthIndex, parseInt(dayStr, 10));
    if (!Number.isNaN(parsedDate.getTime())) {
      return getDateString(parsedDate);
    }
  }

  const weekdays = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'];
  const weekdayRegex = /\b(next\s+)?(sunday|monday|tuesday|wednesday|thursday|friday|saturday)\b/i;
  const weekdayMatch = message.match(weekdayRegex);
  if (weekdayMatch) {
    const [, nextKeyword, weekdayName] = weekdayMatch;
    const targetIndex = weekdays.indexOf(weekdayName.toLowerCase());
    let targetDate = getNextWeekdayDate(currentTime, targetIndex);
    if (nextKeyword) {
      targetDate = addDays(targetDate, 7);
    }
    return getDateString(targetDate);
  }

  return null;
}

function parseHourFromMessage(message) {
  const lower = message.toLowerCase();

  const namedTimes = [
    { keywords: ['midnight'], hour: 0 },
    { keywords: ['noon'], hour: 12 },
    { keywords: ['morning'], hour: 9 },
    { keywords: ['afternoon'], hour: 15 },
    { keywords: ['evening'], hour: 18 },
    { keywords: ['night'], hour: 20 }
  ];

  for (const entry of namedTimes) {
    if (entry.keywords.some(keyword => lower.includes(keyword))) {
      return entry.hour;
    }
  }

  const timeRegex = /(?:at\s*)?(\d{1,2})(?::(\d{2}))?\s*(am|pm)?/i;
  const match = message.match(timeRegex);

  if (!match) return null;

  let hour = parseInt(match[1], 10);
  const minutes = match[2] ? parseInt(match[2], 10) : 0;
  const meridiem = match[3]?.toLowerCase();

  if (meridiem === 'pm' && hour < 12) {
    hour += 12;
  } else if (meridiem === 'am' && hour === 12) {
    hour = 0;
  }

  if (!meridiem && hour <= 7) {
    hour += 12;
  }

  if (minutes >= 30) {
    hour = (hour + 1) % 24;
  }

  return hour >= 0 && hour <= 23 ? hour : null;
}

function extractTrackingCode(message) {
  const match = message.match(/\b(\d{8})\b/);
  return match ? match[1] : null;
}

async function handleRateLimitFallback(userMessage, vendorInfo, currentTime) {
  const actionType = detectAction(userMessage);

  if (!actionType) {
    return {
      type: 'error',
      message: 'OpenAI rate limit exceeded and I could not understand your request. Please rephrase or try again shortly.'
    };
  }

  const intent = {
    vendor_name: vendorInfo.name,
    vendor_email: vendorInfo.email
  };

  if (actionType === 'query_availability') {
    intent.action = 'query';
    intent.query_type = 'availability';
    intent.date = parseDateFromMessage(userMessage, currentTime);
    if (!intent.date) {
      return {
        type: 'clarification',
        message: 'I reached the AI rate limit. Please specify the date you want to check availability for (e.g., 2025-01-15).'
      };
    }
    return handleQueryAction(intent, vendorInfo);
  }

  if (actionType === 'query_my') {
    intent.action = 'query';
    intent.query_type = 'my_appointments';
    return handleQueryAction(intent, vendorInfo);
  }

  if (actionType === 'delete') {
    intent.action = 'delete';
    const trackingCode = extractTrackingCode(userMessage);
    if (!trackingCode) {
      return {
        type: 'clarification',
        message: 'I hit the AI rate limit. Please share the 8-digit Appointment ID for the appointment you want to cancel.'
      };
    }
    intent.tracking_code = trackingCode;
    return executeAction(intent, vendorInfo);
  }

  if (actionType === 'update' || actionType === 'create') {
    const date = parseDateFromMessage(userMessage, currentTime);
    const hour = parseHourFromMessage(userMessage);
    let type = parseAppointmentType(userMessage);

    if (!type) {
      type = 'live';
    }

    if (!date || hour === null) {
      return {
        type: 'clarification',
        message: 'I hit the AI rate limit. Please specify the date (YYYY-MM-DD) and hour (0-23) for the appointment.'
      };
    }

    intent.action = actionType === 'create' ? 'create' : 'update';
    intent.date = date;
    intent.hour = hour;
    intent.type = type;
    if (actionType === 'update') {
      const trackingCode = extractTrackingCode(userMessage);
      if (!trackingCode) {
        return {
          type: 'clarification',
          message: 'I hit the AI rate limit. Please include the 8-digit Appointment ID along with the new date and time.'
        };
      }
      intent.tracking_code = trackingCode;
    }

    return executeAction(intent, vendorInfo);
  }

  return {
    type: 'error',
    message: 'Rate limit exceeded and I could not complete your request. Please try again shortly.'
  };
}

export async function processUserMessage(userMessage, conversationHistory, vendorInfo) {
  const currentTime = getISTDate();
  const historyForTrace = (conversationHistory || []).map(entry => ({
    role: entry.role,
    content: entry.content
  }));
  const messages = [
    { role: 'system', content: getSystemPrompt(currentTime) },
    ...getFewShotExamples(currentTime),
    ...conversationHistory,
    {
      role: 'user',
      content: `Vendor Info: Name: ${vendorInfo.name}, Email: ${vendorInfo.email}, Carrier: ${vendorInfo.carrier_name || 'N/A'}\n\nUser Request: ${userMessage}`
    }
  ];

  const langfuseClient = getLangfuseClient();
  const trace = langfuseClient?.trace({
    name: 'appointment_chat',
    userId: vendorInfo.email,
    sessionId: vendorInfo.email,
    metadata: {
      vendorName: vendorInfo.name
    },
    input: {
      message: userMessage,
      vendorInfo,
      conversationHistory: historyForTrace
    }
  });
 
  trace?.event({
    name: 'llm_messages',
    metadata: { messages }
  });

  const finishTrace = (result, metadata = {}) => {
    if (trace) {
      trace.update({
        output: result,
        metadata: {
          responseType: result?.type,
          ...metadata
        }
      });
      // Trace ends automatically after update() in Langfuse SDK
    }
    return result;
  };

  let modelSpan;

  try {
    // Validate OpenAI API key before attempting to call
    if (!process.env.OPENAI_API_KEY) {
      throw new Error('OPENAI_API_KEY must be set in environment variables');
    }

    const client = getOpenAIClient();
    const model = process.env.OPENAI_MODEL || 'gpt-3.5-turbo';

    modelSpan = trace?.span({
      name: 'openai.chat.completions',
      input: { model, messages }
    });

    const completion = await client.chat.completions.create({
      model,
      messages,
      temperature: 0,
      response_format: { type: 'json_object' }
    });

    modelSpan?.update({
      output: completion,
      endTime: new Date()
    });

    const response = completion.choices[0].message.content;
    let parsedResponse;

    try {
      parsedResponse = JSON.parse(response);
    } catch (e) {
      return finishTrace(
        {
          type: 'clarification',
          message: response
        },
        { clarificationReason: 'invalid_json' }
      );
    }

    trace?.event({
      name: 'parsed_intent',
      metadata: parsedResponse
    });

    if (!parsedResponse.action || !['create', 'update', 'delete', 'query'].includes(parsedResponse.action)) {
      return finishTrace(
        {
          type: 'clarification',
          message: response
        },
        { clarificationReason: 'missing_action' }
      );
    }

    let result;
    if (parsedResponse.action === 'query') {
      result = await handleQueryAction(parsedResponse, vendorInfo);
    } else {
      result = await executeAction(parsedResponse, vendorInfo);
    }

    return finishTrace(result);
  } catch (error) {
    modelSpan?.update({
      output: {
        error: error.message,
        code: error.code,
        status: error.status
      },
      endTime: new Date()
    });

    console.error('LLM Error:', error);
    console.error('Error details:', {
      message: error.message,
      code: error.code,
      status: error.status,
      type: error.type,
      name: error.name
    });
    if (error.stack) {
      console.error('Error stack:', error.stack);
    }

    let errorMessage = 'I encountered an error processing your request.';
    const metadata = { errorCode: error.code, status: error.status };

    if (error.code === 'model_not_found' || error.message?.includes('model')) {
      errorMessage = 'The AI model is not available. Please check your OpenAI API key and model access.';
    } else if (error.message?.includes('API key') || error.message?.includes('OPENAI_API_KEY')) {
      errorMessage = 'OpenAI API key is invalid or missing. Please check your configuration.';
    } else if (error.status === 429 || error.code === 'rate_limit_exceeded') {
      try {
        const fallback = await handleRateLimitFallback(userMessage, vendorInfo, currentTime);
        if (fallback) {
          return finishTrace(fallback, { ...metadata, fallback: 'rate_limit' });
        }
      } catch (fallbackError) {
        console.error('Fallback handler error:', fallbackError);
      }
      errorMessage = 'Rate limit exceeded. Please try again in a moment.';
    } else if (error.status === 401 || error.code === 'invalid_api_key') {
      errorMessage = 'Authentication failed. Please check your OpenAI API key.';
    } else if (error.message?.includes('network') || error.message?.includes('ECONNREFUSED') || error.message?.includes('ETIMEDOUT')) {
      errorMessage = 'Network error connecting to AI service. Please check your internet connection and try again.';
    }

    const errorResult = {
      type: 'error',
      message: errorMessage,
      details: process.env.NODE_ENV === 'development' ? error.message : undefined
    };

    return finishTrace(errorResult, metadata);
  }
}