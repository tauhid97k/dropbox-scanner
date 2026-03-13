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
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
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
 * Custom error for Gemini failures — includes structured details for logging.
 */
export class GeminiAnalysisError extends Error {
  public readonly statusCode: number | null
  public readonly geminiResponse: string | null
  public readonly attempts: number

  constructor(
    message: string,
    opts: {
      statusCode?: number | null
      geminiResponse?: string | null
      attempts: number
    },
  ) {
    super(message)
    this.name = 'GeminiAnalysisError'
    this.statusCode = opts.statusCode ?? null
    this.geminiResponse = opts.geminiResponse ?? null
    this.attempts = opts.attempts
  }
}

/**
 * Analyze a document using Gemini Vision to detect RFEs, classify document type,
 * extract client name, date issued, and content summary — all in one OCR pass.
 *
 * HARD FAIL: This function throws GeminiAnalysisError if analysis fails after
 * 3 retries. There is NO fallback — the caller must handle the failure.
 */
export async function analyzeDocument(
  fileData: Buffer,
  fileName: string,
): Promise<DocumentAnalysis> {
  if (!GEMINI_API_KEY) {
    throw new GeminiAnalysisError(
      'GEMINI_API_KEY is not configured. Set it in your environment variables.',
      { attempts: 0 },
    )
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
  const maxRetries = 3
  let lastError: string | null = null
  let lastStatusCode: number | null = null
  let lastRawResponse: string | null = null

  // HTTP status codes that are safe to retry (transient issues)
  const RETRYABLE_STATUS_CODES = new Set([429, 500, 503])

  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      const model = genAI.getGenerativeModel({ model: MODEL_NAME })
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
      if (!text) {
        // Empty response — retryable (model hiccup)
        lastRawResponse = '(empty response)'
        console.warn(
          `[GEMINI] Empty response on attempt ${attempt}/${maxRetries}`,
        )
        if (attempt < maxRetries) {
          await delay(3000 * attempt)
          continue
        }
        throw new GeminiAnalysisError(
          `Gemini returned empty response after ${maxRetries} attempts`,
          { attempts: maxRetries, geminiResponse: lastRawResponse },
        )
      }

      // Parse JSON from response (handle markdown code blocks)
      const jsonMatch = text.match(/\{[\s\S]*\}/)
      if (!jsonMatch) {
        // Bad format — retryable (model occasionally returns non-JSON)
        lastRawResponse = text.substring(0, 500)
        console.warn(
          `[GEMINI] No JSON found in response on attempt ${attempt}/${maxRetries}:`,
          lastRawResponse,
        )
        if (attempt < maxRetries) {
          await delay(3000 * attempt)
          continue
        }
        throw new GeminiAnalysisError(
          `Gemini response did not contain valid JSON after ${maxRetries} attempts`,
          { attempts: maxRetries, geminiResponse: lastRawResponse },
        )
      }

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
    } catch (error: unknown) {
      // ── Already our custom error — re-throw immediately ──
      if (error instanceof GeminiAnalysisError) throw error

      const err = error as Error & {
        status?: number
        statusText?: string
        errorDetails?: Array<{ reason?: string; domain?: string }>
      }
      const errorMsg = err.message || String(error)
      const errorName = err.name || ''

      // ── SDK: Bad input (wrong params, bad base64) — PERMANENT, no retry ──
      // GoogleGenerativeAIRequestInputError has name containing "RequestInput"
      if (errorName.includes('RequestInput')) {
        console.error(
          `[GEMINI] ❌ PERMANENT INPUT ERROR (no retry): ${errorMsg}`,
        )
        throw new GeminiAnalysisError(
          `Gemini request input error: ${errorMsg}`,
          { attempts: attempt, geminiResponse: null },
        )
      }

      // ── SDK: HTTP/fetch error — has .status property ──
      // GoogleGenerativeAIFetchError sets .status, .statusText, .errorDetails
      if (typeof err.status === 'number') {
        const status = err.status
        lastStatusCode = status
        lastError = errorMsg
        lastRawResponse = err.statusText || errorMsg.substring(0, 500)

        // Permanent HTTP errors — stop immediately, no point retrying
        // 400 = bad request, 403 = key blocked/forbidden, 404 = model not found
        if (!RETRYABLE_STATUS_CODES.has(status)) {
          console.error(
            `[GEMINI] ❌ PERMANENT HTTP ${status} (no retry): ${errorMsg}`,
            err.errorDetails || '',
          )
          throw new GeminiAnalysisError(
            `Gemini API returned HTTP ${status}: ${err.statusText || errorMsg}`,
            {
              statusCode: status,
              geminiResponse: lastRawResponse,
              attempts: attempt,
            },
          )
        }

        // Retryable HTTP errors (429 rate limit, 500 internal, 503 overloaded)
        console.warn(
          `[GEMINI] ⚠️ HTTP ${status} on attempt ${attempt}/${maxRetries}: ${errorMsg}`,
        )

        if (attempt < maxRetries) {
          // 429: longer backoff (rate limit). 503/500: shorter backoff (transient).
          const baseMs = status === 429 ? 10000 : 5000
          const waitMs =
            baseMs * Math.pow(2, attempt - 1) + Math.random() * 2000
          console.warn(`[GEMINI] Retrying in ${Math.round(waitMs)}ms...`)
          await delay(waitMs)
          continue
        }
        // Fall through to exhausted retries below
      } else {
        // ── Non-SDK error (network timeout, JSON parse error, etc.) — retryable ──
        lastError = errorMsg
        lastRawResponse = errorMsg.substring(0, 500)

        console.warn(
          `[GEMINI] ⚠️ Error on attempt ${attempt}/${maxRetries}: ${errorMsg}`,
        )

        if (attempt < maxRetries) {
          const waitMs = 5000 * Math.pow(2, attempt - 1) + Math.random() * 2000
          console.warn(`[GEMINI] Retrying in ${Math.round(waitMs)}ms...`)
          await delay(waitMs)
          continue
        }
      }
    }
  }

  // All retries exhausted — hard fail
  throw new GeminiAnalysisError(
    `Gemini AI analysis failed after ${maxRetries} attempts. Last error: ${lastError || 'Unknown'}`,
    {
      statusCode: lastStatusCode,
      geminiResponse: lastRawResponse,
      attempts: maxRetries,
    },
  )
}
