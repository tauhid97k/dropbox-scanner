import { getDocketwiseToken } from './auth-tokens'

const DOCKETWISE_API_URL =
  process.env.DOCKETWISE_API_URL || 'https://app.docketwise.com/api/v1'
const MAX_RETRIES = 3

const delay = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms))

// Fetch with retry and rate-limit handling
async function fetchWithRetry(
  url: string,
  options: RequestInit,
  retries = MAX_RETRIES,
): Promise<Response> {
  for (let attempt = 0; attempt <= retries; attempt++) {
    const response = await fetch(url, options)

    if (response.status === 429) {
      if (attempt < retries) {
        const retryAfter = response.headers.get('Retry-After')
        const backoffMs = retryAfter
          ? parseInt(retryAfter) * 1000
          : Math.pow(2, attempt + 1) * 1000
        console.warn(
          `[DOCKETWISE] Rate limited, waiting ${backoffMs}ms before retry ${attempt + 1}/${retries}`,
        )
        await delay(backoffMs)
        continue
      }
    }

    return response
  }

  throw new Error('Max retries exceeded')
}

// Parse X-Pagination header from Docketwise API
export interface DocketwisePagination {
  total: number
  nextPage: number | null
  previousPage: number | null
  totalPages: number
}

function parsePagination(response: Response): DocketwisePagination {
  const header = response.headers.get('X-Pagination')
  if (!header) {
    return { total: 0, nextPage: null, previousPage: null, totalPages: 1 }
  }
  try {
    const parsed = JSON.parse(header)
    return {
      total: parsed.total || 0,
      nextPage: parsed.next_page || null,
      previousPage: parsed.previous_page || null,
      totalPages: parsed.total_pages || 1,
    }
  } catch {
    return { total: 0, nextPage: null, previousPage: null, totalPages: 1 }
  }
}

// Docketwise API types
export interface DocketwiseContact {
  id: number
  first_name: string | null
  last_name: string | null
  middle_name: string | null
  company_name: string | null
  email: string | null
  lead: boolean
  created_at: string
  updated_at: string
}

export interface DocketwiseMatter {
  id: number
  number: string | null
  title: string
  description: string | null
  client_id: number | null
  attorney_id: number | null
  created_at: string
  updated_at: string
  archived: boolean
  status: string | null
  type: string | null
}

export interface DocketwiseDocument {
  id: number
  title: string
  firm_id: number
  client_id: number
  created_at: string
  updated_at: string
  archived: boolean
  size: number
  doc_url: string
}

// ─── Service Class ───

export class DocketwiseService {
  private accessToken: string

  constructor(accessToken: string) {
    this.accessToken = accessToken
  }

  private get headers(): Record<string, string> {
    return {
      Authorization: `Bearer ${this.accessToken}`,
      'Content-Type': 'application/json',
    }
  }

  // ─── Contacts ───

  async getContacts(
    page = 1,
    type?: 'Person' | 'Institution',
    filter?: string,
  ): Promise<{
    contacts: DocketwiseContact[]
    pagination: DocketwisePagination
  }> {
    const params = new URLSearchParams({ page: String(page) })
    if (type) params.set('type', type)
    if (filter) params.set('filter', filter)

    const response = await fetchWithRetry(
      `${DOCKETWISE_API_URL}/contacts?${params}`,
      { headers: this.headers },
    )

    if (!response.ok) {
      throw new Error(
        `Failed to fetch contacts: ${response.status} ${response.statusText}`,
      )
    }

    const contacts = await response.json()
    const pagination = parsePagination(response)

    return { contacts, pagination }
  }

  async getContact(contactId: number): Promise<DocketwiseContact> {
    const response = await fetchWithRetry(
      `${DOCKETWISE_API_URL}/contacts/${contactId}`,
      { headers: this.headers },
    )

    if (!response.ok) {
      throw new Error(
        `Failed to fetch contact ${contactId}: ${response.status}`,
      )
    }

    return response.json()
  }

  // ─── Matters ───

  async getMatters(
    page = 1,
    filter?: string,
  ): Promise<{
    matters: DocketwiseMatter[]
    pagination: DocketwisePagination
  }> {
    const params = new URLSearchParams({ page: String(page) })
    if (filter) params.set('filter', filter)

    const response = await fetchWithRetry(
      `${DOCKETWISE_API_URL}/matters?${params}`,
      { headers: this.headers },
    )

    if (!response.ok) {
      throw new Error(
        `Failed to fetch matters: ${response.status} ${response.statusText}`,
      )
    }

    const matters = await response.json()
    const pagination = parsePagination(response)

    return { matters, pagination }
  }

  async getMatter(matterId: number): Promise<DocketwiseMatter> {
    const response = await fetchWithRetry(
      `${DOCKETWISE_API_URL}/matters/${matterId}`,
      { headers: this.headers },
    )

    if (!response.ok) {
      throw new Error(`Failed to fetch matter ${matterId}: ${response.status}`)
    }

    return response.json()
  }

  // ─── Documents ───

  async getDocuments(
    page = 1,
    search?: string,
  ): Promise<{
    documents: DocketwiseDocument[]
    pagination: DocketwisePagination
  }> {
    const params = new URLSearchParams({ page: String(page) })
    if (search) params.set('search', search)

    const response = await fetchWithRetry(
      `${DOCKETWISE_API_URL}/documents?${params}`,
      { headers: this.headers },
    )

    if (!response.ok) {
      throw new Error(`Failed to fetch documents: ${response.status}`)
    }

    const documents = await response.json()
    const pagination = parsePagination(response)

    return { documents, pagination }
  }

  async uploadDocument(params: {
    title: string
    filename: string
    base64Data: string
    clientId: number
    matterId?: number
    description?: string
  }): Promise<DocketwiseDocument> {
    const body = {
      document: {
        title: params.title,
        filename: params.filename,
        base64_data: params.base64Data,
        client_id: params.clientId,
        ...(params.matterId && { matter_id: params.matterId }),
        ...(params.description && { description: params.description }),
      },
    }

    const response = await fetchWithRetry(`${DOCKETWISE_API_URL}/documents`, {
      method: 'POST',
      headers: this.headers,
      body: JSON.stringify(body),
    })

    if (!response.ok) {
      const errorText = await response.text()
      throw new Error(
        `Failed to upload document: ${response.status} - ${errorText}`,
      )
    }

    return response.json()
  }

  async downloadDocument(documentId: number): Promise<{ url: string }> {
    const response = await fetchWithRetry(
      `${DOCKETWISE_API_URL}/documents/${documentId}/download`,
      { headers: this.headers },
    )

    if (!response.ok) {
      throw new Error(
        `Failed to download document ${documentId}: ${response.status}`,
      )
    }

    return response.json()
  }
}

// ─── Factory ───

// Create a DocketwiseService using the shared firm-wide token
export async function createDocketwiseService(): Promise<DocketwiseService | null> {
  const token = await getDocketwiseToken()
  if (!token) {
    return null
  }
  return new DocketwiseService(token)
}
