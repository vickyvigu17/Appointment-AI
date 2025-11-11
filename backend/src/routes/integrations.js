import express from 'express';
import {
  createAppointment,
  updateAppointmentByTrackingCode,
  deleteAppointmentByTrackingCode
} from '../services/appointmentService.js';

const router = express.Router();

router.post('/n8n', async (req, res) => {
  try {
    const normalized = normalizePayload(req.body);
    let result;
    let message;

    switch (normalized.action) {
      case 'create': {
        result = await createAppointment({
          date: normalized.date,
          hour: normalized.hour,
          type: normalized.type,
          vendor_name: normalized.vendorName,
          vendor_email: normalized.vendorEmail,
          carrier_name: normalized.carrierName
        });

        message = `Booked ${normalized.type} appointment on ${normalized.date} at ${formatHour(normalized.hour)} IST.`;
        break;
      }

      case 'update': {
        if (!normalized.trackingCode) {
          throw new Error('Tracking code is required to reschedule an appointment.');
        }

        const targetDate = normalized.newDate ?? normalized.date;
        const targetHour = normalized.newHour ?? normalized.hour;

        if (!targetDate || targetHour === undefined) {
          throw new Error('Reschedule requests must include the new date and time.');
        }

        result = await updateAppointmentByTrackingCode(
          normalized.trackingCode,
          targetDate,
          targetHour
        );

        message = `Rescheduled appointment ${normalized.trackingCode} to ${targetDate} at ${formatHour(targetHour)} IST.`;
        break;
      }

      case 'delete': {
        if (!normalized.trackingCode) {
          throw new Error('Tracking code is required to cancel an appointment.');
        }

        result = await deleteAppointmentByTrackingCode(normalized.trackingCode);
        message = `Cancelled appointment ${normalized.trackingCode}.`;
        break;
      }

      default:
        throw new Error('Unsupported action.');
    }

    res.json({
      status: 'success',
      action: normalized.action,
      message,
      tracking_code: result?.tracking_code ?? normalized.trackingCode ?? null,
      appointment: result,
      meta: {
        request_id: normalized.requestId,
        timezone: normalized.timezone,
        source_email: normalized.sourceEmail
      }
    });
  } catch (error) {
    console.error('n8n integration error:', error);
    res.status(400).json({
      status: 'error',
      message: error.message,
      details: error.details || undefined
    });
  }
});

function normalizePayload(payload) {
  if (Array.isArray(payload)) {
    if (payload.length === 0) {
      throw new Error('Request body array must contain at least one item.');
    }
    payload = payload[0];
  }

  if (!payload || typeof payload !== 'object') {
    throw new Error('Request body must be a JSON object.');
  }

  const action = mapAction(payload.action);
  if (!action) {
    throw new Error(`Unsupported action "${payload.action}". Expected book, reschedule, or cancel.`);
  }

  const vendorName = payload.vendor_name?.trim();
  const carrierName = payload.carrier_name?.trim();
  let vendorEmail = (payload.vendor_email || extractEmail(payload.source_email?.from))?.trim();
  const type = normalizeAppointmentType(payload.appointment_type || payload.type);
  const date = normalizeDate(payload.requested_date || payload.date);
  const hour = parseHour(payload.requested_time || payload.time);
  const trackingCode = payload.tracking_code || payload.appointment_id || payload.appointment_reference || payload.tracking;
  const newDate = normalizeDate(payload.new_date || payload.reschedule_date);
  const newHour = parseHour(payload.new_time || payload.reschedule_time);
  const requestId = payload.source_email?.message_id || payload.request_id || null;

  if (!vendorEmail && vendorName) {
    vendorEmail = buildFallbackVendorEmail(vendorName);
  }

  if (action === 'create') {
    requireField(vendorName, 'Vendor name is required to create an appointment.');
    requireField(vendorEmail, 'Vendor email is required to create an appointment.');
    requireField(carrierName, 'Carrier name is required to create an appointment.');
    requireField(type, 'Appointment type (live/drop) is required to create an appointment.');
    requireField(date, 'Requested date is required to create an appointment.');
    requireHour(hour, 'Requested time is required to create an appointment.');
  }

  if (action !== 'create') {
    requireField(trackingCode, 'Tracking code is required for reschedule or cancel actions.');
  }

  return {
    action,
    vendorName,
    vendorEmail,
    carrierName,
    type,
    date,
    hour,
    newDate,
    newHour,
    trackingCode,
    requestId,
    timezone: payload.timezone || 'Asia/Kolkata',
    sourceEmail: payload.source_email || null
  };
}

function mapAction(rawAction) {
  if (!rawAction) return null;
  const action = rawAction.toString().toLowerCase();

  if (['book', 'create', 'schedule'].includes(action)) return 'create';
  if (['reschedule', 'modify', 'update', 'move', 'change'].includes(action)) return 'update';
  if (['cancel', 'delete', 'remove'].includes(action)) return 'delete';

  return null;
}

function normalizeAppointmentType(rawType) {
  if (!rawType) return null;
  const type = rawType.toString().toLowerCase();

  if (type.includes('live')) return 'live';
  if (type.includes('drop')) return 'drop';

  return null;
}

function normalizeDate(rawDate) {
  if (!rawDate) return null;

  if (/^\d{4}-\d{2}-\d{2}$/.test(rawDate)) {
    return rawDate;
  }

  const parsed = new Date(rawDate);
  if (Number.isNaN(parsed.getTime())) {
    throw new Error(`Invalid date value: ${rawDate}`);
  }

  return parsed.toISOString().slice(0, 10);
}

function parseHour(rawTime) {
  if (!rawTime) return undefined;
  const time = rawTime.toString().trim();
  const match = time.match(/^([0-9]{1,2})(?::([0-9]{2}))?\s*(am|pm)?$/i);

  if (!match) {
    throw new Error(`Invalid time value: ${rawTime}`);
  }

  let hour = parseInt(match[1], 10);
  const minutes = match[2] ? parseInt(match[2], 10) : 0;
  const meridiem = match[3]?.toLowerCase();

  if (meridiem === 'pm' && hour < 12) hour += 12;
  if (meridiem === 'am' && hour === 12) hour = 0;

  if (hour < 0 || hour > 23) {
    throw new Error('Hour must be between 0 and 23.');
  }

  if (minutes >= 30) {
    hour = (hour + 1) % 24;
  }

  return hour;
}

function formatHour(hour) {
  return String(hour).padStart(2, '0') + ':00';
}

function extractEmail(raw) {
  if (!raw) return null;
  const match = raw.match(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/i);
  return match ? match[0].toLowerCase() : null;
}

function requireField(value, message) {
  if (!value) {
    throw new Error(message);
  }
}

function requireHour(value, message) {
  if (value === undefined || value === null) {
    throw new Error(message);
  }
}

function buildFallbackVendorEmail(vendorName) {
  const normalized = vendorName
    .toString()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '.')
    .replace(/^\.+|\.+$/g, '');

  if (!normalized) {
    return 'vendor@example.com';
  }

  return `${normalized}@gmail.com`;
}

export default router;
