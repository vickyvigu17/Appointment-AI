import Brevo from '@getbrevo/brevo';

const APP_LINK = 'https://appointment-booking-frontend-tco0.onrender.com/';

let transactionalClient = null;

function getTransactionalClient() {
  if (!transactionalClient) {
    const apiKey = process.env.BREVO_API_KEY;

    if (!apiKey) {
      throw new Error('BREVO_API_KEY must be set to send emails via Brevo');
    }

    transactionalClient = new Brevo.TransactionalEmailsApi();
    transactionalClient.authentications.apiKey.apiKey = apiKey;
  }

  return transactionalClient;
}

async function sendEmail({ subject, htmlLines, textLines, recipientEmail, recipientName }) {
  if (!recipientEmail) {
    console.warn('Email skipped: recipient email is missing');
    return;
  }

  if (!process.env.BREVO_API_KEY) {
    console.warn('Email skipped: BREVO_API_KEY is not configured');
    return;
  }

  const senderEmail = process.env.BREVO_SENDER_EMAIL;
  const senderName = process.env.BREVO_SENDER_NAME || 'Appointment Desk';

  if (!senderEmail) {
    console.warn('Email skipped: BREVO_SENDER_EMAIL is not configured');
    return;
  }

  const client = getTransactionalClient();
  const sendSmtpEmail = new Brevo.SendSmtpEmail();

  sendSmtpEmail.to = [
    {
      email: recipientEmail,
      name: recipientName || undefined
    }
  ];

  sendSmtpEmail.sender = {
    email: senderEmail,
    name: senderName
  };

  sendSmtpEmail.subject = subject;
  sendSmtpEmail.htmlContent = wrapHtml(htmlLines);
  sendSmtpEmail.textContent = textLines.join('\n');

  await client.sendTransacEmail(sendSmtpEmail);
}

export async function sendAppointmentConfirmationEmail({
  recipientEmail,
  recipientName,
  appointmentDate,
  appointmentHour,
  appointmentType,
  trackingCode
}) {
  const formattedHour = formatHour(appointmentHour);
  const friendlyType = formatType(appointmentType);

  const htmlLines = [
    'Dear User,',
    'Your appointment booking is confirmed.',
    `Appointment ID : <strong>${trackingCode}</strong>`,
    `Time : ${formattedHour}`,
    `Date : ${appointmentDate}`,
    `Type : ${friendlyType}`,
    `In future you can use our app directly to book appointments as well - <a href="${APP_LINK}" target="_blank">@${APP_LINK}</a>`,
    'Thanks & have a wonderful day :)'
  ];

  const textLines = [
    'Dear User,',
    '',
    'Your appointment booking is confirmed.',
    `Appointment ID : ${trackingCode}`,
    `Time : ${formattedHour}`,
    `Date : ${appointmentDate}`,
    `Type : ${friendlyType}`,
    '',
    `In future you can use our app directly to book appointments as well - @${APP_LINK}`,
    '',
    'Thanks & have a wonderful day :)'
  ];

  await sendEmail({
    subject: 'Appointment Confirmed',
    htmlLines,
    textLines,
    recipientEmail,
    recipientName
  });
}

export async function sendAppointmentRescheduleEmail({
  recipientEmail,
  recipientName,
  appointmentDate,
  appointmentHour,
  appointmentType,
  trackingCode
}) {
  const formattedHour = formatHour(appointmentHour);
  const friendlyType = formatType(appointmentType);

  const htmlLines = [
    'Dear User,',
    'Your appointment is rescheduled',
    `Appointment ID : <strong>${trackingCode}</strong>`,
    `Time : ${formattedHour}`,
    `Date : ${appointmentDate}`,
    `Type : ${friendlyType}`,
    `In future you can use our app directly to book appointments - <a href="${APP_LINK}" target="_blank">@${APP_LINK}</a>`,
    'Thanks & have a wonderful day'
  ];

  const textLines = [
    'Dear User,',
    '',
    'Your appointment is rescheduled',
    `Appointment ID : ${trackingCode}`,
    `Time : ${formattedHour}`,
    `Date : ${appointmentDate}`,
    `Type : ${friendlyType}`,
    '',
    `In future you can use our app directly to book appointments - @${APP_LINK}`,
    '',
    'Thanks & have a wonderful day'
  ];

  await sendEmail({
    subject: 'Appointment Rescheduled',
    htmlLines,
    textLines,
    recipientEmail,
    recipientName
  });
}

export async function sendAppointmentCancellationEmail({
  recipientEmail,
  recipientName,
  trackingCode
}) {
  const htmlLines = [
    'Dear User,',
    'Your appointment is cancelled.',
    `Appointment ID : <strong>${trackingCode}</strong>`,
    'Thanks & have a wonderful day :)'
  ];

  const textLines = [
    'Dear User,',
    '',
    'Your appointment is cancelled.',
    `Appointment ID : ${trackingCode}`,
    '',
    'Thanks & have a wonderful day :)'
  ];

  await sendEmail({
    subject: 'Appointment Cancelled',
    htmlLines,
    textLines,
    recipientEmail,
    recipientName
  });
}

function wrapHtml(lines) {
  const paragraphs = lines
    .map(line => `<p style="margin: 0 0 12px; font-size: 15px; color: #1f2933;">${line}</p>`)
    .join('');

  return `
    <html>
      <body style="font-family: Arial, sans-serif; background-color: #f9fafb; padding: 24px;">
        <div style="max-width: 520px; margin: 0 auto; background: #ffffff; border-radius: 12px; padding: 32px; box-shadow: 0 10px 25px rgba(15, 23, 42, 0.08);">
          ${paragraphs}
        </div>
      </body>
    </html>
  `;
}

function formatHour(hour) {
  if (hour === undefined || hour === null) {
    return '—';
  }
  return `${String(hour).padStart(2, '0')}:00`;
}

function formatType(type) {
  if (!type) return '—';
  if (type.toLowerCase() === 'live') return 'Live';
  if (type.toLowerCase() === 'drop') return 'Drop';
  return type;
}

