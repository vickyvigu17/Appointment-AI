import { format, parseISO, isBefore, isPast } from 'date-fns';
import { zonedTimeToUtc, utcToZonedTime } from 'date-fns-tz';

const IST_TIMEZONE = 'Asia/Kolkata';

export function getISTDate() {
  return utcToZonedTime(new Date(), IST_TIMEZONE);
}

export function isPastDate(dateStr, hour) {
  const now = getISTDate();
  const appointmentDateTime = zonedTimeToUtc(
    new Date(`${dateStr}T${String(hour).padStart(2, '0')}:00:00`),
    IST_TIMEZONE
  );
  return isBefore(appointmentDateTime, now);
}

export function formatDateForDisplay(dateStr) {
  return format(parseISO(dateStr), 'EEEE, MMMM d, yyyy');
}

export function getDateString(date) {
  return format(date, 'yyyy-MM-dd');
}

