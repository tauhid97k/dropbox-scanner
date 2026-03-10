/**
 * Gemini AI Service — Document analysis using Google Gemini Vision
 * Analyzes uploaded documents to:
 * 1. Detect if a document is an RFE (Request for Evidence)
 * 2. Extract client name from the document
 */

import { GoogleGenerativeAI } from '@google/generative-ai'

const GEMINI_API_KEY = process.env.GEMINI_API_KEY || ''
const MODEL_NAME = 'gemini-2.0-flash'

export interface DocumentAnalysis {
  isRfe: boolean
  clientName: string | null
  confidence: number
  summary: string | null
}

const delay = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms))

/**
 * Analyze a document using Gemini Vision to detect RFEs and extract metadata.
 * Sends the file directly to Gemini's multimodal API.
 */
export async function analyzeDocument(
  fileData: Buffer,
  fileName: string,
): Promise<DocumentAnalysis> {
  if (!GEMINI_API_KEY) {
    console.warn('[GEMINI] API key not configured — skipping AI analysis')
    return { isRfe: false, clientName: null, confidence: 0, summary: null }
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

TASK: Analyze this document and determine:
1. Is this document a "Request for Evidence" (RFE) from USCIS?
   - An RFE is an official notice from U.S. Citizenship and Immigration Services requesting additional evidence or documentation for a pending immigration case.
   - Look for keywords like: "Request for Evidence", "RFE", "USCIS", "additional evidence", "Notice of Intent to Deny", "I-797E", or official USCIS letterhead.
2. Who is the primary client/subject/beneficiary this document is about?
3. A brief one-line summary of the document.

RESPONSE FORMAT — return ONLY valid JSON:
{
  "is_rfe": true/false,
  "client_name": "Full Name" or null,
  "confidence": 0.0 to 1.0,
  "summary": "Brief one-line description"
}

RULES:
- confidence: How confident you are in the RFE classification (0.0 = unsure, 1.0 = certain)
- client_name: Use Title Case. Return null if no name can be found.
- If the document is clearly not immigration-related, set is_rfe to false with high confidence.`

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
          clientName: parsed.client_name || null,
          confidence: typeof parsed.confidence === 'number' ? parsed.confidence : 0,
          summary: parsed.summary || null,
        }
      } catch (error) {
        const errorStr = String(error)
        if (errorStr.includes('429') || errorStr.toLowerCase().includes('quota')) {
          const waitMs = 5000 * Math.pow(2, attempt) + Math.random() * 2000
          console.warn(
            `[GEMINI] Rate limited on ${modelId}, waiting ${Math.round(waitMs)}ms (attempt ${attempt + 1}/${maxRetries})`,
          )
          await delay(waitMs)
          continue
        }
        console.error(`[GEMINI] Error with ${modelId} attempt ${attempt + 1}:`, error)
        break // Try next model
      }
    }
  }

  console.warn('[GEMINI] All models/retries exhausted — returning default')
  return { isRfe: false, clientName: null, confidence: 0, summary: null }
}
