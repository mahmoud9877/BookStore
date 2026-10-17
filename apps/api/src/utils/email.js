import nodemailer from "nodemailer";

async function sendEmail({ to = [], subject, html, attachments = [] } = {}) {
  try {
    // Initialize transporter with Gmail service
    const transporter = nodemailer.createTransport({
      service: "gmail",
      auth: {
        user: process.env.EMAIL,
        pass: process.env.EMAIL_PASSWORD,
      },
    });

    // Send email
    const info = await transporter.sendMail({
      from: `"70ka Company" <${process.env.EMAIL}>`, // sender address
      to: Array.isArray(to) ? to.join(",") : to, // list of receivers
      subject: subject || "Hello ✔", // Subject line
      html: html || `<p>Hello world?</p>`, // HTML body content
      attachments, // Optional attachments
    });
    console.log("Message sent: %s", info.messageId);
    return !info.rejected.length; // Returns true if no addresses were rejected
  } catch (error) {
    console.error("Error sending email:", error);
    return false; // Return false if email fails to send
  }
}

export default sendEmail;
