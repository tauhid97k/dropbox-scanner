/**
 * Gemini AI Service — Document analysis using Google Gemini Vision
 * Analyzes uploaded documents to:
 * 1. Detect if a document is an RFE (Request for Evidence)
 * 2. Classify the document type (Approval, Denial, RFE, Receipt, etc.)
 * 3. Extract client name, date issued, and content summary
 * 4. Generate a smart file name for organized storage
 */

import { GoogleGenerativeAI } from '@google/generative-ai'

const GEMINI_API_KEY = process.env.GEMINI_API_KEY || ''
const MODEL_NAME = 'gemini-2.0-flash'

export interface DocumentAnalysis {
  isRfe: boolean
  documentType: string | null
  clientName: string | null
  dateIssued: string | null
  confidence: number
  contentSummary: string | null
  /** @deprecated Use contentSummary instead */
  summary: string | null
}

const delay = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms))

/**
 * Build a smart file name from AI analysis results.
 * Format: Doc-Type_Client-Name_MM-DD-YY.ext
 * Example: Request-for-Evidence_Jason-Stateham_12-03-26.pdf
 */
export function buildSmartFileName(
  analysis: DocumentAnalysis,
  originalFileName: string,
): string {
  const ext = originalFileName.includes('.')
    ? '.' + originalFileName.split('.').pop()!.toLowerCase()
    : ''

  // Document type segment — Title-Case, hyphenated
  const docType = analysis.documentType
    ? toTitleHyphen(analysis.documentType)
    : 'Document'

  // Client name segment — Title-Case, hyphenated
  const client = analysis.clientName
    ? toTitleHyphen(analysis.clientName)
    : 'Unknown-Client'

  // Date segment — MM-DD-YY format, prefer AI-extracted date, fallback to today
  const date = analysis.dateIssued
    ? formatDateMMDDYY(analysis.dateIssued)
    : formatDateMMDDYY(new Date().toISOString())

  return `${docType}_${client}_${date}${ext}`
}

/** Convert a string to Title-Case-Hyphenated: "request for evidence" → "Request-for-Evidence" */
function toTitleHyphen(value: string): string {
  return value
    .trim()
    .replace(/[^a-zA-Z0-9\s_-]/g, '')
    .split(/[\s_-]+/)
    .filter(Boolean)
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join('-')
    .substring(0, 60)
}

/** Format a date string to MM-DD-YY (e.g. 12-03-26). Falls back to cleaned raw value. */
function formatDateMMDDYY(dateStr: string): string {
  const parsed = new Date(dateStr)
  if (!isNaN(parsed.getTime())) {
    const mm = String(parsed.getUTCMonth() + 1).padStart(2, '0')
    const dd = String(parsed.getUTCDate()).padStart(2, '0')
    const yy = String(parsed.getUTCFullYear()).slice(-2)
    return `${mm}-${dd}-${yy}`
  }
  // Fallback: clean up and return as-is
  return dateStr.replace(/[^a-zA-Z0-9-]/g, '-').substring(0, 8)
}

/**
 * Analyze a document using Gemini Vision to detect RFEs, classify document type,
 * extract client name, date issued, and content summary — all in one OCR pass.
 * Sends the file directly to Gemini's multimodal API.
 */
export async function analyzeDocument(
  fileData: Buffer,
  fileName: string,
): Promise<DocumentAnalysis> {
  if (!GEMINI_API_KEY) {
    console.warn('[GEMINI] API key not configured — skipping AI analysis')
    return {
      isRfe: false,
      documentType: null,
      clientName: null,
      dateIssued: null,
      confidence: 0,
      contentSummary: null,
      summary: null,
    }
  }

  // Determine MIME type from extension
  const ext = fileName.toLowerCase().split('.').pop() || ''
  const mimeMap: Record<string, string> = {
    pdf: 'application/pdf',
    png: 'image/png',
    jpg: 'image/jpeg',
    jpeg: 'image/jpeg',
    webp: 'image/webp',
    tiff: 'image/tiff',
    gif: 'image/gif',
  }
  const mimeType = mimeMap[ext] || 'application/octet-stream'

  const prompt = `You are a Document Intelligence Agent specialized in U.S. immigration law.
You perform OCR and deep content analysis on legal documents.

TASK: Read and analyze this entire document thoroughly. Determine ALL of the following:

1. **RFE Detection**: Is this a "Request for Evidence" (RFE) from USCIS?
   - An RFE is an official notice requesting additional evidence for a pending immigration case.
   - Look for: "Request for Evidence", "RFE", "USCIS", "additional evidence", "Notice of Intent to Deny", "I-797E", USCIS letterhead.

2. **Document Type Classification**: What kind of document is this? Classify it with a SHORT, strategic label (2-5 words max) that a law firm admin can instantly understand just by reading a filename.
   Use labels like these (pick the closest match, or create a similarly concise label):
   - "Approval Notice" — case approved (I-797, approval notice)
   - "Denial Notice" — case denied
   - "Request for Evidence" — RFE from USCIS
   - "Receipt Notice" — USCIS receipt/acknowledgment
   - "Intent to Deny" — NOID (Notice of Intent to Deny)
   - "EAD Card" — Employment Authorization Document
   - "I94 Record" — Arrival/Departure record
   - "Visa Stamp" — Visa page from passport
   - "Court Notice" — Immigration court notice/hearing
   - "USCIS Letter" — General USCIS correspondence
   - "Biometrics Notice" — Biometrics appointment
   - "Transfer Notice" — Case transfer notice
   - "Withdrawal Ack" — Withdrawal acknowledgment
   - "Legal Brief" — Attorney brief/motion
   - "Client Document" — General client-provided document
   - "Medical Exam" — I-693 or medical examination form
   - "Tax Return" — Tax document
   - "Employment Letter" — Employment verification
   - "Identity Doc" — Passport, birth certificate, ID
   - "Other Notice" — Any other government notice
   Keep it SHORT and clear. This becomes the first part of the filename.

3. **Client/Beneficiary Name**: Who is the primary person this document is about? Title Case.

4. **Date Issued**: The date printed on the document (the official issued/notice date, NOT today). Format: YYYY-MM-DD. Return null if no date is visible.

5. **Content Summary**: A concise 1-2 sentence summary of what this document actually says — the key decision, action, or information it conveys.

RESPONSE FORMAT — return ONLY valid JSON, nothing else:
{
  "is_rfe": true/false,
  "document_type": "Short-Label",
  "client_name": "Full Name" or null,
  "date_issued": "YYYY-MM-DD" or null,
  "confidence": 0.0 to 1.0,
  "content_summary": "What this document says/decides"
}

RULES:
- confidence: How confident you are in the overall classification (0.0 = unsure, 1.0 = certain).
- client_name: Title Case. Return null only if absolutely no name can be found.
- document_type: Must be SHORT (2-5 words). Use plain words like "Request for Evidence" — the system will format it into the filename automatically.
- date_issued: The date ON the document, not today's date. YYYY-MM-DD format. null if not found.
- content_summary: Be specific — e.g. "I-485 adjustment of status approved" not just "approval notice".
- If the document is not immigration-related, still classify it with a sensible short label.`

  const genAI = new GoogleGenerativeAI(GEMINI_API_KEY)
  const modelsToTry = [MODEL_NAME, 'gemini-2.0-flash', 'gemini-1.5-flash']
  const maxRetries = 3

  for (const modelId of modelsToTry) {
    const model = genAI.getGenerativeModel({ model: modelId })

    for (let attempt = 0; attempt < maxRetries; attempt++) {
      try {
        const result = await model.generateContent([
          prompt,
          {
            inlineData: {
              mimeType,
              data: fileData.toString('base64'),
            },
          },
        ])

        const text = result.response.text()
        if (!text) continue

        // Parse JSON from response (handle markdown code blocks)
        const jsonMatch = text.match(/\{[\s\S]*\}/)
        if (!jsonMatch) continue

        const parsed = JSON.parse(jsonMatch[0])
        return {
          isRfe: Boolean(parsed.is_rfe),
          documentType: parsed.document_type || null,
          clientName: parsed.client_name || null,
          dateIssued: parsed.date_issued || null,
          confidence:
            typeof parsed.confidence === 'number' ? parsed.confidence : 0,
          contentSummary: parsed.content_summary || null,
          summary: parsed.content_summary || null,
        }
      } catch (error) {
        const errorStr = String(error)
        if (
          errorStr.includes('429') ||
          errorStr.toLowerCase().includes('quota')
        ) {
          const waitMs = 5000 * Math.pow(2, attempt) + Math.random() * 2000
          console.warn(
            `[GEMINI] Rate limited on ${modelId}, waiting ${Math.round(waitMs)}ms (attempt ${attempt + 1}/${maxRetries})`,
          )
          await delay(waitMs)
          continue
        }
        console.error(
          `[GEMINI] Error with ${modelId} attempt ${attempt + 1}:`,
          error,
        )
        break // Try next model
      }
    }
  }

  console.warn('[GEMINI] All models/retries exhausted — returning default')
  return {
    isRfe: false,
    documentType: null,
    clientName: null,
    dateIssued: null,
    confidence: 0,
    contentSummary: null,
    summary: null,
  }
}
