import { Injectable, Inject, UnauthorizedException } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { Strategy, ExtractJwt } from 'passport-jwt';
import * as admin from 'firebase-admin';
import * as crypto from 'crypto';
import { FIREBASE_ADMIN_INJECT } from '../../firebase/firebase.module';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { User } from '../../entities/user.entity';
import { RefreshToken } from '../../entities/refresh-token.entity';
import axios from 'axios';

@Injectable()
export class FirebaseJwtStrategy extends PassportStrategy(Strategy, 'firebase-jwt') {
    constructor(
        @Inject(FIREBASE_ADMIN_INJECT)
        private readonly firebaseAdmin: admin.app.App,
        @InjectRepository(User)
        private readonly userRepository: Repository<User>,
        @InjectRepository(RefreshToken)
        private readonly refreshTokenRepository: Repository<RefreshToken>,
    ) {
        super({
            jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
            ignoreExpiration: false,
            secretOrKey: 'not_needed_for_firebase', // Passport requires this but we override verification
        });
    }

    async validate(payload: any, done: Function) {
        // This method is called after the token is extracted.
        // However, Passport standard strategy assumes local JWT secret verification.
        // We override the internal verification logic or handle it here.
    }

    // We actually override the authenticate method for direct Firebase verification
    // but for simplicity in NestJS, we can use a custom Guard that calls this strategy
    // or use the validate method if the token is already decoded.
    // The best practice for Firebase + Passport is often a custom strategy or 
    // simply a Guard. Let's implement a clean Strategy that fits the NestJS pattern.

    async authenticate(req: any) {
        const token = ExtractJwt.fromAuthHeaderAsBearerToken()(req);
        if (!token) {
            return this.fail(new UnauthorizedException('Missing token'), 401);
        }

        try {
            // ✅ CHECK 1: Is this token in our revoked blacklist?
            const tokenHash = crypto.createHash('sha256').update(token).digest('hex');
            const revokedToken = await this.refreshTokenRepository.findOne({
                where: {
                    token: tokenHash,
                    is_revoked: true
                }
            });

            if (revokedToken) {
                return this.fail(new UnauthorizedException('Token has been revoked'), 401);
            }

            // CHECK 2: Dual Token Verification (Firebase + Google tokeninfo fallback)
            let decodedToken: any;
            
            try {
                // Method 1: Try Firebase Admin SDK first
                decodedToken = await this.firebaseAdmin.auth().verifyIdToken(token);
            } catch (firebaseError) {
                // Method 2: Fallback to Google tokeninfo API
                try {
                    const response = await axios.get(
                        `https://oauth2.googleapis.com/tokeninfo?id_token=${token}`
                    );

                    // Validate Google token
                    if (!response.data.aud || !response.data.aud.includes('googleusercontent.com')) {
                        throw new UnauthorizedException('Invalid token audience');
                    }
                    if (response.data.iss !== 'https://accounts.google.com') {
                        throw new UnauthorizedException('Invalid token issuer');
                    }

                    // Map Google response to Firebase-like format
                    decodedToken = {
                        uid: response.data.sub,
                        email: response.data.email,
                    };
                } catch (googleError) {
                    throw new UnauthorizedException('Invalid token - failed both Firebase and Google verification');
                }
            }

            // CHECK 3: Find user in database
            const user = await this.userRepository.findOne({
                where: { firebase_uid: decodedToken.uid },
                relations: ['profile', 'roleEntity']
            });

            if (!user) {
                return this.fail(new UnauthorizedException('User not found in database'), 401);
            }

            if (user.is_active === false) {
                return this.fail(new UnauthorizedException('Account disabled. Please contact your contractor.'), 401);
            }

            // User entity doesn't have status field, so no status validation needed

            this.success(user);
        } catch (error) {
            return this.fail(new UnauthorizedException(error.message), 401);
        }
    }
}