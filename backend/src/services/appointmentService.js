import { createClient } from '@supabase/supabase-js';
import { isPastDate } from '../utils/dateUtils.js';
import {
  sendAppointmentCancellationEmail,
  sendAppointmentConfirmationEmail,
  sendAppointmentRescheduleEmail
} from './emailService.js';

// Lazy initialization of Supabase client
let supabase = null;

function getSupabaseClient() {
  if (!supabase) {
    const url = process.env.SUPABASE_URL;
    const key = process.env.SUPABASE_KEY;
    
    if (!url || !key) {
      throw new Error('Supabase URL and Key must be set in environment variables');
    }
    
    supabase = createClient(url, key);
  }
  return supabase;
}

function generateTrackingCode() {
  return Math.floor(10000000 + Math.random() * 90000000).toString();
}

async function generateUniqueTrackingCode(client, maxAttempts = 5) {
  for (let attempt = 0; attempt < maxAttempts; attempt++) {
    const code = generateTrackingCode();
    const { data, error } = await client
      .from('appointments')
      .select('id')
      .eq('tracking_code', code)
      .limit(1);

    if (error) {
      throw error;
    }

    if (!data || data.length === 0) {
      return code;
    }
  }

  throw new Error('Failed to generate a unique appointment ID. Please try again.');
}

export async function getSlotsForDate(date) {
  const client = getSupabaseClient();
  // Get all appointments for the date
  const { data: appointments, error: apptError } = await client
    .from('appointments')
    .select('hour, type')
    .eq('date', date);

  if (apptError) throw apptError;

  // Get blocked slots
  const { data: blockedSlots, error: blockedError } = await client
    .from('blocked_slots')
    .select('hour, reason')
    .eq('date', date);

  if (blockedError) throw blockedError;

  // Initialize slots (0-23)
  const slots = Array.from({ length: 24 }, (_, i) => ({
    hour: i,
    isBlocked: false,
    liveCount: 0,
    dropCount: 0,
    available: true,
    blockedReason: null
  }));

  // Mark blocked slots
  blockedSlots?.forEach(blocked => {
    const slot = slots[blocked.hour];
    slot.isBlocked = true;
    slot.available = false;
    slot.blockedReason = blocked.reason;
  });

  // Count appointments
  appointments?.forEach(apt => {
    const slot = slots[apt.hour];
    if (apt.type === 'live') slot.liveCount++;
    else if (apt.type === 'drop') slot.dropCount++;
  });

  // Determine availability
  slots.forEach(slot => {
    if (!slot.isBlocked) {
      slot.available = slot.liveCount < 1 && slot.dropCount < 10;
    }
  });

  return slots;
}

export async function createAppointment(appointmentData) {
  const { date, hour, type, vendor_name, vendor_email, carrier_name } = appointmentData;

  if (!carrier_name) {
    throw new Error('Carrier name is required to create an appointment');
  }

  // Validate past date
  if (isPastDate(date, hour)) {
    throw new Error('Cannot book appointments in the past');
  }

  // Get current slot status
  const slots = await getSlotsForDate(date);
  const slot = slots[hour];

  // Validate rules
  if (slot.isBlocked) {
    throw new Error(`Slot ${hour}:00 is blocked. Reason: ${slot.blockedReason || 'N/A'}`);
  }

  if (type === 'live' && slot.liveCount >= 1) {
    throw new Error(`Slot ${hour}:00 already has a live appointment`);
  }

  if (type === 'drop' && slot.dropCount >= 10) {
    throw new Error(`Slot ${hour}:00 already has 10 drop appointments`);
  }

  // Create appointment
  const client = getSupabaseClient();
  const trackingCode = await generateUniqueTrackingCode(client);
  const { data, error } = await client
    .from('appointments')
    .insert({
      date,
      hour,
      type,
      vendor_name,
      vendor_email,
      carrier_name,
      tracking_code: trackingCode
    })
    .select()
    .single();

  if (error) {
    if (error.code === '23505') { // Unique constraint violation
      throw new Error('You already have an appointment in this slot');
    }
    throw error;
  }

  try {
    await sendAppointmentConfirmationEmail({
      recipientEmail: vendor_email,
      recipientName: vendor_name,
      appointmentDate: date,
      appointmentHour: hour,
      appointmentType: type,
      trackingCode: data.tracking_code
    });
  } catch (emailError) {
    console.error('Failed to send confirmation email:', emailError);
  }

  return data;
}

export async function updateAppointment(id, newDate, newHour) {
  // Get existing appointment
  const client = getSupabaseClient();
  const { data: existing, error: fetchError } = await client
    .from('appointments')
    .select('*')
    .eq('id', id)
    .single();

  if (fetchError || !existing) {
    throw new Error('Appointment not found');
  }

  // Validate past date
  if (isPastDate(newDate, newHour)) {
    throw new Error('Cannot reschedule to a past date/time');
  }

  // Check new slot availability
  const slots = await getSlotsForDate(newDate);
  const slot = slots[newHour];

  if (slot.isBlocked) {
    throw new Error(`Slot ${newHour}:00 is blocked`);
  }

  if (existing.type === 'live' && slot.liveCount >= 1) {
    throw new Error(`Slot ${newHour}:00 already has a live appointment`);
  }

  if (existing.type === 'drop' && slot.dropCount >= 10) {
    throw new Error(`Slot ${newHour}:00 already has 10 drop appointments`);
  }

  // Update appointment
  const { data, error } = await client
    .from('appointments')
    .update({ date: newDate, hour: newHour })
    .eq('id', id)
    .select()
    .single();

  if (error) throw error;
  return data;
}

export async function deleteAppointment(id) {
  const client = getSupabaseClient();
  const { data, error } = await client
    .from('appointments')
    .delete()
    .eq('id', id)
    .select()
    .single();

  if (error) throw error;
  if (!data) throw new Error('Appointment not found');
  return data;
}

export async function getAppointmentByTrackingCode(trackingCode) {
  if (!trackingCode) {
    throw new Error('Tracking code is required');
  }

  const client = getSupabaseClient();
  const { data, error } = await client
    .from('appointments')
    .select('*')
    .eq('tracking_code', trackingCode)
    .limit(1);

  if (error) throw error;
  return data?.[0] || null;
}

export async function updateAppointmentByTrackingCode(trackingCode, newDate, newHour) {
  const appointment = await getAppointmentByTrackingCode(trackingCode);

  if (!appointment) {
    throw new Error('Appointment not found for the provided tracking code');
  }

  const updatedAppointment = await updateAppointment(appointment.id, newDate, newHour);

  try {
    await sendAppointmentRescheduleEmail({
      recipientEmail: appointment.vendor_email,
      recipientName: appointment.vendor_name,
      appointmentDate: newDate,
      appointmentHour: newHour,
      appointmentType: appointment.type,
      trackingCode: appointment.tracking_code
    });
  } catch (emailError) {
    console.error('Failed to send reschedule email:', emailError);
  }

  return updatedAppointment;
}

export async function deleteAppointmentByTrackingCode(trackingCode) {
  const appointment = await getAppointmentByTrackingCode(trackingCode);

  if (!appointment) {
    throw new Error('Appointment not found for the provided tracking code');
  }

  const deletedAppointment = await deleteAppointment(appointment.id);

  try {
    await sendAppointmentCancellationEmail({
      recipientEmail: appointment.vendor_email,
      recipientName: appointment.vendor_name,
      trackingCode: appointment.tracking_code
    });
  } catch (emailError) {
    console.error('Failed to send cancellation email:', emailError);
  }

  return deletedAppointment;
}

export async function findNextAvailableSlot(date, hour, type) {
  const slots = await getSlotsForDate(date);
  
  // Check slots from requested hour onwards
  for (let h = hour; h < 24; h++) {
    const slot = slots[h];
    if (slot.isBlocked) continue;
    
    if (type === 'live' && slot.liveCount === 0) {
      return h;
    }
    if (type === 'drop' && slot.dropCount < 10) {
      return h;
    }
  }
  
  return null; // No available slot found
}

export async function getUserAppointments(vendor_email) {
  const client = getSupabaseClient();
  const { data, error } = await client
    .from('appointments')
    .select('*')
    .eq('vendor_email', vendor_email)
    .order('date', { ascending: true })
    .order('hour', { ascending: true });

  if (error) throw error;
  return data || [];
}

