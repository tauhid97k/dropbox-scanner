import { GoogleGenerativeAI } from '@google/generative-ai'

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY || '')

export interface AIAnalysisResult {
  clientName: string | null
  matterType: string | null
  confidence: number
}

export class AIService {
  private model

  constructor() {
    // Use gemini-2.0-flash for fast, reliable document analysis
    this.model = genAI.getGenerativeModel({
      model: 'gemini-2.0-flash',
    })
  }

  async analyzeDocument(
    fileData: Buffer,
    filename: string,
  ): Promise<AIAnalysisResult> {
    try {
      // Determine MIME type
      const ext = filename.toLowerCase().split('.').pop()
      const mimeMap: Record<string, string> = {
        pdf: 'application/pdf',
        png: 'image/png',
        jpg: 'image/jpeg',
        jpeg: 'image/jpeg',
        webp: 'image/webp',
      }
      const mimeType = mimeMap[ext || ''] || 'application/octet-stream'

      const prompt = `
You are a highly accurate Document Intelligence Agent.

TASK: Identify the primary subject/person/client name this document is ABOUT, and determine the matter type if it's an immigration document.

IDENTIFICATION RULES:
1. For National ID (NID) / Passports: Extract the Full Name of the cardholder.
2. For Cover Letters / Resumes: Extract the name of the applicant (usually at the top).
3. For Invoices/Receipts: Extract the 'Bill To' or 'Customer' name.
4. For Professional Letters: The author or the primary subject is the client.
5. For Immigration Documents: Look for USCIS forms (I-485, I-130, I-765, etc.) and identify the petitioner/beneficiary.

MATTER TYPE RULES (for immigration cases):
- I-485 = Adjustment of Status
- I-130 = Petition for Alien Relative
- I-765 = Employment Authorization
- I-131 = Advance Parole
- I-140 = Immigrant Petition for Alien Worker
- N-400 = Naturalization
- I-601 = Waiver of Grounds of Inadmissibility
- Asylum documents = Asylum Application

RETURN JSON ONLY:
{
  "clientName": "Full Name in Title Case",
  "matterType": "Type of matter or null if unknown",
  "confidence": 0.85
}

Use confidence score 0.0-1.0 based on how clear the information is.
Use null for fields you're uncertain about.
`

      // For PDFs and images, send directly to Gemini Vision
      const result = await this.model.generateContent({
        contents: [
          {
            role: 'user',
            parts: [
              { text: prompt },
              {
                inlineData: {
                  mimeType,
                  data: fileData.toString('base64'),
                },
              },
            ],
          },
        ],
        generationConfig: {
          temperature: 0.1,
          responseMimeType: 'application/json',
        },
      })

      const responseText = result.response.text()
      const parsed = JSON.parse(responseText) as AIAnalysisResult

      return {
        clientName: parsed.clientName || null,
        matterType: parsed.matterType || null,
        confidence: parsed.confidence || 0,
      }
    } catch (error) {
      console.error('AI Analysis error:', error)
      return {
        clientName: null,
        matterType: null,
        confidence: 0,
      }
    }
  }

  // Batch analyze multiple documents for client suggestions
  async suggestClientFromText(
    text: string,
    knownClients: Array<string>,
  ): Promise<{ client: string | null; confidence: number }> {
    try {
      const prompt = `
Given this document text and a list of known clients, identify which client this document likely belongs to.

Known Clients:
${knownClients.join('\n')}

Document Text:
${text.substring(0, 2000)}

Return JSON only:
{
  "client": "Best matching client name or null",
  "confidence": 0.85
}

If no match is found, return null for client.
`

      const result = await this.model.generateContent({
        contents: [{ role: 'user', parts: [{ text: prompt }] }],
        generationConfig: {
          temperature: 0.1,
          responseMimeType: 'application/json',
        },
      })

      const responseText = result.response.text()
      const parsed = JSON.parse(responseText) as {
        client: string | null
        confidence: number
      }

      return {
        client: parsed.client,
        confidence: parsed.confidence || 0,
      }
    } catch (error) {
      console.error('Client suggestion error:', error)
      return { client: null, confidence: 0 }
    }
  }
}

export const aiService = new AIService()
