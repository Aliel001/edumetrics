import nodemailer from 'nodemailer';

// Helper to get SMTP transport
let etherealTransporterPromise: Promise<nodemailer.Transporter> | null = null;

async function getTransporter(): Promise<nodemailer.Transporter> {
  const host = process.env.SMTP_HOST;
  const port = process.env.SMTP_PORT ? parseInt(process.env.SMTP_PORT, 10) : 587;
  const user = process.env.SMTP_USER;
  const pass = process.env.SMTP_PASS;

  // Real SMTP config provided by user - Always resolve dynamically to reflect updated secrets immediately
  if (host && user && pass) {
    console.log(`📬 Real SMTP credentials detected! Creating transport to ${host}:${port} for user: ${user}`);
    return nodemailer.createTransport({
      host,
      port,
      secure: port === 465,
      auth: {
        user,
        pass,
      },
      tls: {
        rejectUnauthorized: false
      }
    });
  } else {
    // No credentials provided. Generate temporary Ethereal test account on the fly.
    // This allows real emails to be generated and previewed via Ethereal Mail during preview!
    if (!etherealTransporterPromise) {
      etherealTransporterPromise = (async () => {
        console.log('📬 SMTP configurations not found in env variables. Generating an Ethereal SMTP account...');
        try {
          const testAccount = await nodemailer.createTestAccount();
          console.log(`🚀 Created Ethereal SMTP test sender: ${testAccount.user}`);
          return nodemailer.createTransport({
            host: 'smtp.ethereal.email',
            port: 587,
            secure: false,
            auth: {
              user: testAccount.user,
              pass: testAccount.pass,
            },
          });
        } catch (err: any) {
          console.error('❌ Failed to create Ethereal SMTP account:', err.message || err);
          // Fallback: simple log-to-console transporter (so it never crashes)
          return {
            sendMail: async (options: any) => {
              console.log('\n--- FALLBACK LOCAL MAIL LOG ---');
              console.log(`TO: ${options.to}`);
              console.log(`SUBJECT: ${options.subject}`);
              console.log(`HTML CONTENT:\n${options.html}`);
              console.log('-------------------------------\n');
              return { messageId: 'fallback-id', previewUrl: null };
            }
          } as any;
        }
      })();
    }
    return etherealTransporterPromise;
  }
}

export function getCachedTransporter(): Promise<nodemailer.Transporter> {
  return getTransporter();
}

export interface EmailOptions {
  to: string;
  subject: string;
  html: string;
}

export async function sendMail(options: EmailOptions) {
  try {
    const transporter = await getCachedTransporter();
    const fromAddress = process.env.SMTP_FROM || process.env.SMTP_USER || 'no-reply@edumetric.com';
    
    const info = await transporter.sendMail({
      from: `"EduMetric Portal" <${fromAddress}>`,
      to: options.to,
      subject: options.subject,
      html: options.html,
    });

    console.log(`📧 Email sent to ${options.to}. MessageID: ${info.messageId}`);
    
    // If it's an Ethereal account, print preview URL to terminal
    const previewUrl = nodemailer.getTestMessageUrl(info);
    if (previewUrl) {
      console.log(`🔗 PREVIEW REAL EMAIL IN BROWSER HERE -> ${previewUrl}`);
      return { success: true, previewUrl };
    }
    
    return { success: true };
  } catch (error: any) {
    console.error(`❌ Failed to send email to ${options.to}:`, error.message || error);
    return { success: false, error: error.message || error };
  }
}

/**
 * Sends a welcome and password setup invitation to the teacher.
 */
export async function sendTeacherInviteEmail(params: {
  email: string;
  fullname: string;
  schoolName: string;
  setupUrl: string;
  creatorName: string;
}) {
  const { email, fullname, schoolName, setupUrl, creatorName } = params;

  const subject = `Welcome to ${schoolName} - Set Up Your Teacher Profile`;
  const html = `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="utf-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <title>Welcome to EduMetric</title>
      <style>
        body {
          font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif;
          background-color: #f4f6f9;
          margin: 0;
          padding: 0;
          -webkit-font-smoothing: antialiased;
        }
        .container {
          max-width: 600px;
          margin: 40px auto;
          background: #ffffff;
          border-radius: 8px;
          box-shadow: 0 4px 12px rgba(0, 0, 0, 0.05);
          overflow: hidden;
          border: 1px solid #e1e4e8;
        }
        .header {
          background-color: #022e66;
          color: #ffffff;
          padding: 32px 24px;
          text-align: center;
        }
        .header h1 {
          margin: 0;
          font-size: 24px;
          font-weight: 600;
          letter-spacing: -0.5px;
        }
        .content {
          padding: 32px 24px;
          line-height: 1.6;
          color: #2d3748;
        }
        .greeting {
          font-size: 18px;
          font-weight: 600;
          margin-top: 0;
          color: #1a202c;
        }
        .details-box {
          background-color: #f7fafc;
          border-left: 4px solid #022e66;
          padding: 16px;
          margin: 24px 0;
          border-radius: 0 4px 4px 0;
        }
        .details-row {
          margin-bottom: 8px;
          font-size: 14px;
        }
        .details-row:last-child {
          margin-bottom: 0;
        }
        .details-label {
          font-weight: 600;
          color: #4a5568;
          display: inline-block;
          width: 120px;
        }
        .btn-container {
          text-align: center;
          margin: 32px 0;
        }
        .btn {
          background-color: #2563eb;
          color: #ffffff !important;
          text-decoration: none;
          padding: 12px 32px;
          font-size: 15px;
          font-weight: 600;
          border-radius: 6px;
          display: inline-block;
          transition: background-color 0.2s ease;
          box-shadow: 0 2px 4px rgba(37, 99, 235, 0.2);
        }
        .btn:hover {
          background-color: #1d4ed8;
        }
        .footer {
          background-color: #f7fafc;
          padding: 24px;
          text-align: center;
          font-size: 12px;
          color: #718096;
          border-top: 1px solid #e1e4e8;
        }
        .expiry-note {
          font-size: 12px;
          color: #e53e3e;
          margin-top: 16px;
          text-align: center;
        }
      </style>
    </head>
    <body>
      <div class="container">
        <div class="header">
          <h1>Welcome to EduMetric Portal</h1>
        </div>
        <div class="content">
          <p class="greeting">Hello ${fullname},</p>
          <p>You have been assigned as a <strong>Teacher</strong>/staff member in the <strong>${schoolName}</strong> Academic Management system by administrator <strong>${creatorName}</strong>.</p>
          
          <p>Please click the button below to verify your email address, activate your teacher profile, and configure your password:</p>
          
          <div class="btn-container">
            <a href="${setupUrl}" class="btn" target="_blank">Set Up Your Password</a>
          </div>
          
          <div class="details-box">
            <div class="details-row">
              <span class="details-label">Portal:</span>
              <span>EduMetric School Management</span>
            </div>
            <div class="details-row">
              <span class="details-label">Login Email:</span>
              <span><strong>${email}</strong></span>
            </div>
            <div class="details-row">
              <span class="details-label">Assigned Roles:</span>
              <span>Teaching Staff / Academics</span>
            </div>
          </div>
          
          <p class="expiry-note">⚠️ Note: This security link is personal and will expire in 24 hours.</p>
          <p>If you did not expect this, you can safely ignore this email.</p>
        </div>
        <div class="footer">
          <p>Sent securely on behalf of ${schoolName} Administration</p>
          <p>&copy; 2026 EduMetric Inc. All rights reserved.</p>
        </div>
      </div>
    </body>
    </html>
  `;

  return sendMail({ to: email, subject, html });
}

/**
 * Sends real login credentials (username and password) immediately to the teacher.
 */
export async function sendTeacherCredentialsEmail(params: {
  email: string;
  fullname: string;
  schoolName: string;
  clearPassword: string;
  creatorName: string;
  loginUrl: string;
  verifyUrl: string;
}) {
  const { email, fullname, schoolName, clearPassword, creatorName, loginUrl, verifyUrl } = params;

  const subject = `Activate Your Teacher Account & Verify Email - ${schoolName}`;
  const html = `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="utf-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <title>Verify Email & Log In - ${schoolName}</title>
      <style>
        body {
          font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif;
          background-color: #f4f6f9;
          margin: 0;
          padding: 0;
          -webkit-font-smoothing: antialiased;
        }
        .container {
          max-width: 600px;
          margin: 40px auto;
          background: #ffffff;
          border-radius: 8px;
          box-shadow: 0 4px 12px rgba(0, 0, 0, 0.05);
          overflow: hidden;
          border: 1px solid #e1e4e8;
        }
        .header {
          background-color: #022e66;
          color: #ffffff;
          padding: 32px 24px;
          text-align: center;
        }
        .header h1 {
          margin: 0;
          font-size: 24px;
          font-weight: 600;
          letter-spacing: -0.5px;
        }
        .content {
          padding: 32px 24px;
          line-height: 1.6;
          color: #2d3748;
        }
        .greeting {
          font-size: 18px;
          font-weight: 600;
          margin-top: 0;
          color: #1a202c;
        }
        .activation-card {
          border: 2px dashed #059669;
          background-color: #f0fdf4;
          padding: 20px;
          border-radius: 8px;
          margin: 20px 0;
          text-align: center;
        }
        .details-box {
          background-color: #f7fafc;
          border-left: 4px solid #022e66;
          padding: 20px;
          margin: 24px 0;
          border-radius: 0 4px 4px 0;
        }
        .details-row {
          margin-bottom: 12px;
          font-size: 15px;
        }
        .details-row:last-child {
          margin-bottom: 0;
        }
        .details-label {
          font-weight: 600;
          color: #4a5568;
          display: inline-block;
          width: 145px;
        }
        .btn-container {
          text-align: center;
          margin: 24px 0;
        }
        .btn {
          background-color: #10b981;
          color: #ffffff !important;
          text-decoration: none;
          padding: 14px 34px;
          font-size: 16px;
          font-weight: bold;
          border-radius: 6px;
          display: inline-block;
          transition: background-color 0.2s ease;
          box-shadow: 0 4px 6px rgba(16, 185, 129, 0.2);
        }
        .btn:hover {
          background-color: #059669;
        }
        .footer {
          background-color: #f7fafc;
          padding: 24px;
          text-align: center;
          font-size: 12px;
          color: #718096;
          border-top: 1px solid #e1e4e8;
        }
        .security-warning {
          font-size: 12px;
          color: #e53e3e;
          padding: 12px;
          background-color: #fff5f5;
          border: 1px dashed #feb2b2;
          border-radius: 6px;
          margin-top: 24px;
        }
      </style>
    </head>
    <body>
      <div class="container">
        <div class="header">
          <h1>Welcome to ${schoolName}</h1>
        </div>
        <div class="content">
          <p class="greeting">Hello ${fullname},</p>
          <p>You have been registered as a <strong>Teacher</strong>/school staff member in the <strong>${schoolName}</strong> Academics Portal by administrator <strong>${creatorName}</strong>.</p>
          
          <div class="activation-card">
            <h3 style="color: #047857; margin-top: 0;">🔒 Action Required: Email Validation</h3>
            <p style="margin-bottom: 15px;">Your account is currently inactive. You must verify your email address by clicking the button below before you are allowed to log in and access the system.</p>
            <div class="btn-container">
              <a href="${verifyUrl}" class="btn" target="_blank">Verify Email & Activate Account</a>
            </div>
            <p style="font-size: 11px; color: #6b7280; margin-bottom: 0;">This security activation link will expire in 48 hours.</p>
          </div>

          <p>Once you verify and activate your email address using the link above, you may log in to the portal using these generated credentials:</p>
          
          <div class="details-box">
            <div class="details-row">
              <span class="details-label">Academics Portal:</span>
              <span>EduMetric School Manager</span>
            </div>
            <div class="details-row">
              <span class="details-label">Your Username:</span>
              <span><strong style="color: #2563eb;">${email}</strong></span>
            </div>
            <div class="details-row">
              <span class="details-label">Your Password:</span>
              <span><strong>${clearPassword}</strong></span>
            </div>
            <div class="details-row">
              <span class="details-label">Assigned Role:</span>
              <span>Teaching Staff</span>
            </div>
          </div>
          
          <div class="security-warning">
            <strong>🔒 Security Advisory:</strong> Please protect these login details. You should change this password from your profile settings after your first login. Keep this email confidential.
          </div>
        </div>
        <div class="footer">
          <p>This is an automated system email sent securely on behalf of ${schoolName} Administration</p>
          <p>&copy; 2026 EduMetric Inc. All rights reserved.</p>
        </div>
      </div>
    </body>
    </html>
  `;

  return sendMail({ to: email, subject, html });
}
