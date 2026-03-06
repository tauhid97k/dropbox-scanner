import { z } from 'zod'

// File upload validation schema
export const uploadSchema = z.object({
  file: z
    .instanceof(File)
    .refine((file) => file.size > 0, 'File is required')
    .refine((file) => file.size <= 50 * 1024 * 1024, 'File size must be less than 50MB')
    .refine(
      (file) =>
        ['application/pdf', 'image/jpeg', 'image/png', 'image/webp'].includes(file.type),
      'Only PDF, JPG, PNG, and WebP files are allowed'
    ),
  clientName: z.string().optional(),
  matterId: z.string().optional(),
})

export type UploadFormData = z.infer<typeof uploadSchema>

// Client schema
export const clientSchema = z.object({
  id: z.string(),
  name: z.string(),
  email: z.string().email().optional(),
  phone: z.string().optional(),
  createdAt: z.date(),
  fileCount: z.number().default(0),
})

export type Client = z.infer<typeof clientSchema>

// Matter schema
export const matterSchema = z.object({
  id: z.string(),
  docketwiseId: z.string(),
  clientName: z.string(),
  matterType: z.string().optional(),
  description: z.string().optional(),
  status: z.enum(['active', 'inactive', 'closed']).default('active'),
  fileCount: z.number().default(0),
  createdAt: z.date(),
})

export type Matter = z.infer<typeof matterSchema>

// File metadata schema
export const fileMetadataSchema = z.object({
  id: z.string(),
  fileName: z.string(),
  fileType: z.string(),
  clientName: z.string(),
  matterId: z.string().optional(),
  dropboxPath: z.string(),
  docketwiseDocId: z.string().optional(),
  uploadedAt: z.date(),
  uploadedBy: z.string(),
})

export type FileMetadata = z.infer<typeof fileMetadataSchema>

// Email settings schema
export const emailSettingsSchema = z.object({
  recipients: z.array(z.string().email()).min(1, 'At least one recipient is required'),
  notifyOnUpload: z.boolean().default(true),
  notifyOnError: z.boolean().default(true),
})

export type EmailSettings = z.infer<typeof emailSettingsSchema>
