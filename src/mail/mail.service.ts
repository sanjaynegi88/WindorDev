import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as nodemailer from 'nodemailer';

@Injectable()
export class MailService {
    private readonly logger = new Logger(MailService.name);
    private transporter: nodemailer.Transporter;

    constructor(private readonly configService: ConfigService) {
        const host = this.configService.get<string>('MAIL_HOST');
        const port = Number(this.configService.get('MAIL_PORT')) || 0;
        const secure = this.configService.get<string>('MAIL_SECURE') === 'true';
        const user = this.configService.get<string>('MAIL_USER');
        const pass = this.configService.get<string>('MAIL_PASS');

        

        this.transporter = nodemailer.createTransport({
            host,
            port,
            secure,
            auth: {
                user,
                pass,
            },
        });
    }

    async sendPasswordResetOtp(email: string, otp: string): Promise<void> {
        return this.sendOtpEmail(email, otp, {
            subject: 'Password Reset OTP',
            text: `Your password reset OTP is ${otp}. It will expire in 90 seconds.`,
            html: `<b>Your password reset OTP is ${otp}.</b><p>It will expire in 90 seconds.</p>`,
            logLabel: 'PASSWORD RESET OTP',
        });
    }

    async sendRegistrationVerificationOtp(email: string, otp: string): Promise<void> {
        return this.sendOtpEmail(email, otp, {
            subject: 'Email Verification OTP',
            text: `Your email verification OTP is ${otp}. It will expire in 90 seconds.`,
            html: `<b>Your email verification OTP is ${otp}.</b><p>It will expire in 90 seconds.</p>`,
            logLabel: 'REGISTRATION VERIFICATION OTP',
        });
    }

    private async sendOtpEmail(
        email: string,
        otp: string,
        options: { subject: string; text: string; html: string; logLabel: string },
    ): Promise<void> {
        const mailOptions = {
            from: this.configService.get<string>('MAIL_FROM') || '"Windor Support" <support@windor.com>',
            to: email,
            subject: options.subject,
            text: options.text,
            html: options.html,
        };

        const logMessage = `\n================================================================================\n  ${options.logLabel} for ${email}: ${otp}\n  (Expires in 90 seconds)\n================================================================================`;
        this.logger.log(logMessage);
        console.log(logMessage);

        try {
            await this.transporter.sendMail(mailOptions);
            this.logger.log(`OTP email sent to ${email}`);
        } catch (error: any) {
            this.logger.warn(`Email delivery failed (SMTP not configured). OTP logged above for development.`, {
                error: error?.message || error,
            });
        }
    }
}
