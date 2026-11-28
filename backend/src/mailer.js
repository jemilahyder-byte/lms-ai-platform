const nodemailer = require("nodemailer");

let transporter;

async function sendAnnouncementEmail({ to, courseTitle, title, body }) {
  if (!process.env.SMTP_HOST || !process.env.MAIL_FROM) {
    throw new Error("SMTP_HOST and MAIL_FROM must be configured.");
  }

  if (!transporter) {
    transporter = nodemailer.createTransport({
      host: process.env.SMTP_HOST,
      port: Number(process.env.SMTP_PORT || 1025),
      secure: process.env.SMTP_SECURE === "true",
      ...(process.env.SMTP_USER
        ? {
            auth: {
              user: process.env.SMTP_USER,
              pass: process.env.SMTP_PASS,
            },
          }
        : {}),
      connectionTimeout: 5000,
      greetingTimeout: 5000,
      socketTimeout: 10000,
      disableFileAccess: true,
      disableUrlAccess: true,
    });
  }

  const result = await transporter.sendMail({
    from: process.env.MAIL_FROM,
    to: { address: to },
    subject: "LMS announcement: " + String(title).replace(/[\r\n]+/g, " "),
    text: [
      "Course: " + courseTitle,
      "",
      title,
      "",
      body,
      "",
      "Sign in to LMS AI Platform to view your course.",
    ].join("\n"),
  });

  if (!result.accepted || result.accepted.length === 0) {
    throw new Error("SMTP server did not accept the email.");
  }

  return result.messageId;
}

module.exports = { sendAnnouncementEmail };