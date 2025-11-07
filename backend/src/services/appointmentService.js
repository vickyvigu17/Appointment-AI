import { createClient } from '@supabase/supabase-js';
import { isPastDate } from '../utils/dateUtils.js';

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_KEY
);

export async function getSlotsForDate(date) {
  // Get all appointments for the date
  const { data: appointments, error: apptError } = await supabase
    .from('appointments')
    .select('hour, type')
    .eq('date', date);

  if (apptError) throw apptError;

  // Get blocked slots
  const { data: blockedSlots, error: blockedError } = await supabase
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
  const { date, hour, type, vendor_name, vendor_email } = appointmentData;

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
  const { data, error } = await supabase
    .from('appointments')
    .insert({
      date,
      hour,
      type,
      vendor_name,
      vendor_email
    })
    .select()
    .single();

  if (error) {
    if (error.code === '23505') { // Unique constraint violation
      throw new Error('You already have an appointment in this slot');
    }
    throw error;
  }

  return data;
}

export async function updateAppointment(id, newDate, newHour) {
  // Get existing appointment
  const { data: existing, error: fetchError } = await supabase
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
  const { data, error } = await supabase
    .from('appointments')
    .update({ date: newDate, hour: newHour })
    .eq('id', id)
    .select()
    .single();

  if (error) throw error;
  return data;
}

export async function deleteAppointment(id) {
  const { data, error } = await supabase
    .from('appointments')
    .delete()
    .eq('id', id)
    .select()
    .single();

  if (error) throw error;
  if (!data) throw new Error('Appointment not found');
  return data;
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
  const { data, error } = await supabase
    .from('appointments')
    .select('*')
    .eq('vendor_email', vendor_email)
    .order('date', { ascending: true })
    .order('hour', { ascending: true });

  if (error) throw error;
  return data || [];
}

