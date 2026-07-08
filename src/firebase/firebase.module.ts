import { Module, Global } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as admin from 'firebase-admin';

export const FIREBASE_ADMIN_INJECT = 'FIREBASE_ADMIN';

@Global()
@Module({
  providers: [
    {
      provide: FIREBASE_ADMIN_INJECT,
      useFactory: (configService: ConfigService) => {
        const serviceAccountBase64 = configService.get<string>('FIREBASE_SERVICE_ACCOUNT');
        const projectId = configService.get<string>('FIREBASE_PROJECT_ID');

        if (!serviceAccountBase64) {
          console.warn('FIREBASE_SERVICE_ACCOUNT not found in environment. Firebase Admin SDK not initialized.');
          return null;
        }

        try {
          const serviceAccount = JSON.parse(
            Buffer.from(serviceAccountBase64, 'base64').toString('utf-8'),
          );

          return admin.initializeApp({
            credential: admin.credential.cert(serviceAccount),
            projectId: projectId,
          });
        } catch (error) {
          console.error('Failed to initialize Firebase Admin SDK:', error);
          return null;
        }
      },
      inject: [ConfigService],
    },
  ],
  exports: [FIREBASE_ADMIN_INJECT],
})
export class FirebaseModule {}
