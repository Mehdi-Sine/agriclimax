import "server-only";
import nodemailer from "nodemailer";

const address = /^[a-zA-Z0-9.!#$%&'*+/=?^_`{|}~-]+@[a-zA-Z0-9-]+(?:\.[a-zA-Z0-9-]+)+$/;

export function adminSmtp() {
  const host = process.env.SMTP_HOST;
  const port = process.env.SMTP_PORT;
  const user = process.env.SMTP_USER?.trim();
  const pass = process.env.SMTP_PASS?.replace(/ /g, "");
  const recipient = process.env.AGRICLIMAX_ADMIN_EMAIL?.trim();
  if (host !== "smtp.gmail.com" || port !== "587" || !user || !address.test(user)
      || !pass || !recipient || !address.test(recipient)) {
    throw Error("ADMIN_REPORT_CONFIGURATION");
  }

  const transport = nodemailer.createTransport({
    host,
    port: Number(port),
    secure: false,
    requireTLS: true,
    auth: { user, pass },
    connectionTimeout: 5000,
    dnsTimeout: 5000,
    greetingTimeout: 5000,
    socketTimeout: 8000,
    disableFileAccess: true,
    disableUrlAccess: true,
  });
  return { transport, sender: user, recipient };
}

export async function verifyAdminSmtp() {
  const { transport } = adminSmtp();
  try {
    await transport.verify();
  } catch {
    throw Error("ADMIN_REPORT_SMTP_VERIFICATION_FAILED");
  }
}
