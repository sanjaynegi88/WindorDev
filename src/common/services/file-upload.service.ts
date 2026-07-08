import { Injectable, BadRequestException } from '@nestjs/common';
import * as fs from 'fs';
import * as path from 'path';

@Injectable()
export class FileUploadService {
    private readonly uploadDir = path.join(process.cwd(), 'uploads');

    constructor() {
        // Ensure upload directory exists
        if (!fs.existsSync(this.uploadDir)) {
            fs.mkdirSync(this.uploadDir, { recursive: true });
        }
    }

    async uploadMultipleFiles(files: any[], componentType: string, componentId: string): Promise<string[]> {
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

    private async uploadSingleFile(file: any, componentType: string, componentId: string): Promise<string> {
        // Create directory structure: uploads/componentId/componentType/year/
        const year = new Date().getFullYear();
        const dirPath = path.join(this.uploadDir, componentId, componentType.toLowerCase(), year.toString());
        
        if (!fs.existsSync(dirPath)) {
            fs.mkdirSync(dirPath, { recursive: true });
        }

        // Generate unique filename
        const timestamp = Date.now();
        const randomSuffix = Math.floor(Math.random() * 1000000000);
        const fileExtension = path.extname(file.originalname);
        const fileName = `${timestamp}_${randomSuffix}${fileExtension}`;
        
        const filePath = path.join(dirPath, fileName);
        
        // Write file to disk
        fs.writeFileSync(filePath, file.buffer);
        
        // Return relative path from project root
        const relativePath = path.relative(process.cwd(), filePath).replace(/\\/g, '/');
        return relativePath;
    }

    deleteFile(filePath: string): void {
        const fullPath = path.join(process.cwd(), filePath);
        if (fs.existsSync(fullPath)) {
            fs.unlinkSync(fullPath);
        }
    }
}