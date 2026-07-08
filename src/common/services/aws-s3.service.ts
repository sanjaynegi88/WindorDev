import { Injectable, BadRequestException } from '@nestjs/common';
import { S3Client, PutObjectCommand, DeleteObjectCommand } from '@aws-sdk/client-s3';

@Injectable()
export class AwsS3Service {
    private readonly s3Client: S3Client;
    private readonly bucketName: string;
    private readonly region: string;

    constructor() {
        this.region = process.env.AWS_REGION || 'ap-south-1';
        this.bucketName = process.env.AWS_S3_BUCKET || '';
        
        if (!process.env.AWS_ACCESS_KEY_ID || !process.env.AWS_SECRET_ACCESS_KEY || !this.bucketName) {
            throw new Error('AWS credentials and S3 bucket name must be configured');
        }

        this.s3Client = new S3Client({
            region: this.region,
            credentials: {
                accessKeyId: process.env.AWS_ACCESS_KEY_ID,
                secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
            },
        });
    }

    async uploadFile(file: Express.Multer.File, key: string): Promise<string> {
        try {
            const command = new PutObjectCommand({
                Bucket: this.bucketName,
                Key: key,
                Body: file.buffer,
                ContentType: file.mimetype,
            });

            await this.s3Client.send(command);
            
            // Generate public URL
            const url = `https://${this.bucketName}.s3.${this.region}.amazonaws.com/${key}`;
            return url;
        } catch (error) {
            console.error('S3 upload error:', error);
            throw new BadRequestException('Failed to upload file to S3');
        }
    }

    async uploadMultipleFiles(files: Express.Multer.File[], componentType: string, componentId: string): Promise<string[]> {
        if (!files || files.length === 0) {
            throw new BadRequestException('No files provided');
        }

        const uploadedUrls: string[] = [];

        for (const file of files) {
            const url = await this.uploadSingleFile(file, componentType, componentId);
            uploadedUrls.push(url);
        }

        return uploadedUrls;
    }

    private async uploadSingleFile(file: Express.Multer.File, componentType: string, componentId: string): Promise<string> {
        // Create S3 key structure: uploads/componentType/componentId/timestamp-filename
        const timestamp = Date.now();
        const randomSuffix = Math.floor(Math.random() * 1000000000);
        const fileExtension = file.originalname.split('.').pop();
        const fileName = `${timestamp}_${randomSuffix}.${fileExtension}`;
        const key = `uploads/${componentType.toLowerCase()}/${componentId}/${fileName}`;
        
        return await this.uploadFile(file, key);
    }

    async deleteFile(url: string): Promise<void> {
        try {
            // Extract key from URL
            const urlParts = url.split('.amazonaws.com/');
            if (urlParts.length !== 2) {
                throw new Error('Invalid S3 URL format');
            }
            
            const key = urlParts[1];
            
            const command = new DeleteObjectCommand({
                Bucket: this.bucketName,
                Key: key,
            });

            await this.s3Client.send(command);
        } catch (error) {
            console.error('S3 delete error:', error);
            // Don't throw error for delete operations to avoid breaking the flow
        }
    }

    generateKey(componentType: string, componentId: string, filename: string, prefix?: string): string {
        const timestamp = Date.now();
        const randomSuffix = Math.floor(Math.random() * 1000000000);
        const fileExtension = filename.split('.').pop();
        const finalPrefix = prefix ? `${prefix}_` : '';
        const fileName = `${finalPrefix}${timestamp}_${randomSuffix}.${fileExtension}`;
        return `uploads/${componentType.toLowerCase()}/${componentId}/${fileName}`;
    }
}