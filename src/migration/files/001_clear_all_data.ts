import { QueryRunner } from 'typeorm';
import * as admin from 'firebase-admin';

export async function up(queryRunner: QueryRunner, firestore: admin.firestore.Firestore): Promise<void> {
    console.log('⚠️ DELETING ALL DATA FROM POSTGRESQL...');
    // Delete data from PostgreSQL tables. Order matters to avoid foreign key constraint violations.
    const tablesToClear = [
        'memberships',
        'reports',
        'report_images',
        'roofing',
        'siding',
        'windows_doors',
        'properties',
        'user_profiles',
        'users',
    ];

    for (const table of tablesToClear) {
        try {
            // Using CASCADE to ensure all dependent records are also deleted
            await queryRunner.query(`TRUNCATE TABLE "${table}" CASCADE;`);
            console.log(`✅ Cleared Postgres table: ${table}`);
        } catch (error: any) {
             console.error(`❌ Failed to clear Postgres table ${table}:`, error.message);
        }
    }

    console.log('⚠️ DELETING ALL DATA FROM FIREBASE AUTH AND FIRESTORE...');
    try {
        // 1. Delete all Firebase Auth Users
        const listUsersResult = await admin.auth().listUsers(1000);
        const uids = listUsersResult.users.map((userRecord) => userRecord.uid);
        
        if (uids.length > 0) {
            await admin.auth().deleteUsers(uids);
            console.log(`✅ Deleted ${uids.length} users from Firebase Auth.`);
        } else {
             console.log('✅ No users found in Firebase Auth to delete.');
        }

        // 2. Delete all Firestore 'users' documents
        const usersSnapshot = await firestore.collection('users').get();
        if (!usersSnapshot.empty) {
             const batch = firestore.batch();
             usersSnapshot.docs.forEach((doc) => batch.delete(doc.ref));
             await batch.commit();
             console.log(`✅ Deleted ${usersSnapshot.size} documents from Firestore 'users' collection.`);
        } else {
            console.log('✅ No documents found in Firestore "users" collection to delete.');
        }

         // 3. Delete all Firestore 'user_profiles' documents
         const profilesSnapshot = await firestore.collection('user_profiles').get();
         if (!profilesSnapshot.empty) {
              const profileBatch = firestore.batch();
              profilesSnapshot.docs.forEach((doc) => profileBatch.delete(doc.ref));
              await profileBatch.commit();
              console.log(`✅ Deleted ${profilesSnapshot.size} documents from Firestore 'user_profiles' collection.`);
         } else {
             console.log('✅ No documents found in Firestore "user_profiles" collection to delete.');
         }

    } catch (error: any) {
        console.error('❌ Failed to clear Firebase data:', error.message);
    }
    
    console.log('🎉 ALL DATA CLEARED SUCCESSFULLY.');
}

export async function down(queryRunner: QueryRunner, firestore: admin.firestore.Firestore): Promise<void> {
    console.log('⚠️ Migration down called: Cannot undo data deletion.');
}
