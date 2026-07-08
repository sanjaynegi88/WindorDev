import { BadRequestException } from '@nestjs/common';

export const ALLOWED_IMAGE_TYPES = ['image/jpeg', 'image/jpg', 'image/png', 'image/svg+xml', 'image/webp'];
export const ALLOWED_IMAGE_EXTENSIONS = ['.jpeg', '.jpg', '.png', '.svg', '.webp'];
export const SUPPORTED_IMAGE_FORMATS = ['JPEG', 'JPG', 'PNG', 'SVG', 'WEBP'];

export const ALLOWED_DOC_TYPES = [
  'application/pdf',
  'text/plain',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'application/msword',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  'application/vnd.ms-excel',
  'text/csv',
  'application/vnd.oasis.opendocument.text',
  'application/rtf',
  'text/markdown',
  'application/vnd.openxmlformats-officedocument.presentationml.presentation',
  'application/vnd.ms-powerpoint',
];
export const ALLOWED_DOC_EXTENSIONS = [
  '.pdf',
  '.txt',
  '.docx',
  '.doc',
  '.xlsx',
  '.xls',
  '.csv',
  '.odt',
  '.rtf',
  '.md',
  '.pptx',
  '.ppt',
];

export const fileValidator = (req: any, file: Express.Multer.File, callback: Function) => {
  // Validate MIME type
  const allowedMimes = [...ALLOWED_IMAGE_TYPES, ...ALLOWED_DOC_TYPES];
  if (!allowedMimes.includes(file.mimetype)) {
    return callback(
      new BadRequestException({
        statusCode: 400,
        message: 'Invalid file type',
        error: 'INVALID_FILE_TYPE',
        details: {
          allowedTypes: [
            'jpeg',
            'jpg',
            'png',
            'svg',
            'webp',
            'pdf',
            'txt',
            'docx',
            'doc',
            'xlsx',
            'xls',
            'csv',
            'odt',
            'rtf',
            'md',
            'pptx',
            'ppt',
          ],
          receivedType: file.mimetype,
          fileName: file.originalname,
          solution: 'Upload only supported image or document types.',
        },
      }),
      false,
    );
  }

  // Validate file extension
  const ext = file.originalname.toLowerCase().substring(file.originalname.lastIndexOf('.'));
  const allowedExts = [...ALLOWED_IMAGE_EXTENSIONS, ...ALLOWED_DOC_EXTENSIONS];
  if (!allowedExts.includes(ext)) {
    return callback(
      new BadRequestException({
        statusCode: 400,
        message: 'Invalid file extension',
        error: 'INVALID_FILE_EXTENSION',
        details: {
          allowedExtensions: [
            'jpeg',
            'jpg',
            'png',
            'svg',
            'webp',
            'pdf',
            'txt',
            'docx',
            'doc',
            'xlsx',
            'xls',
            'csv',
            'odt',
            'rtf',
            'md',
            'pptx',
            'ppt',
          ],
          receivedExtension: ext,
          fileName: file.originalname,
          solution: 'Rename file with a supported extension.',
        },
      }),
      false,
    );
  }

  callback(null, true);
};

export const profileImageValidator = (req: any, file: Express.Multer.File, callback: Function) => {
  // Validate MIME type for images only
  if (!ALLOWED_IMAGE_TYPES.includes(file.mimetype)) {
    return callback(
      new BadRequestException({
        statusCode: 400,
        message: 'Invalid file type. Only image files are allowed for profile pictures.',
        error: 'INVALID_IMAGE_TYPE',
        details: {
          allowedTypes: ['jpeg', 'jpg', 'png', 'svg', 'webp'],
          receivedType: file.mimetype,
          fileName: file.originalname,
          solution: 'Upload only supported image types (JPEG, JPG, PNG, SVG, WEBP).',
        },
      }),
      false,
    );
  }

  // Validate file extension for images only
  const ext = file.originalname.toLowerCase().substring(file.originalname.lastIndexOf('.'));
  if (!ALLOWED_IMAGE_EXTENSIONS.includes(ext)) {
    return callback(
      new BadRequestException({
        statusCode: 400,
        message: 'Invalid file extension. Only image extensions are allowed for profile pictures.',
        error: 'INVALID_IMAGE_EXTENSION',
        details: {
          allowedExtensions: ['jpeg', 'jpg', 'png', 'svg', 'webp'],
          receivedExtension: ext,
          fileName: file.originalname,
          solution: 'Rename file with a supported image extension.',
        },
      }),
      false,
    );
  }

  // No file size limit for profile images - allow any size
  callback(null, true);
};

export const imageFileFilter = fileValidator;