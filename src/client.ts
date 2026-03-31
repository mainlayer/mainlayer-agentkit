const BASE_URL = 'https://api.mainlayer.fr'

export interface MainlayerResource {
  id: string
  name: string
  description?: string
  priceUsd: number
  feeModel: string
  createdAt: string
  updatedAt: string
}

export interface MainlayerAccessResult {
  hasAccess: boolean
  resourceId: string
  payerId: string
  expiresAt?: string
}

export interface MainlayerPaymentResult {
  success: boolean
  paymentId: string
  resourceId: string
  payerId: string
  amountUsd: number
  paidAt: string
}

export interface MainlayerDiscoverParams {
  query?: string
  limit?: number
}

export interface MainlayerCreateResourceParams {
  name: string
  priceUsd: number
  feeModel: string
  description?: string
}

export class MainlayerApiError extends Error {
  constructor(
    message: string,
    public readonly status: number,
    public readonly body: unknown,
  ) {
    super(message)
    this.name = 'MainlayerApiError'
  }
}

export class MainlayerClient {
  private readonly baseUrl: string

  constructor(
    private readonly apiKey: string,
    baseUrl?: string,
  ) {
    if (!apiKey || apiKey.trim() === '') {
      throw new Error('Mainlayer API key is required')
    }
    this.baseUrl = baseUrl ?? BASE_URL
  }

  private buildHeaders(): Record<string, string> {
    return {
      Authorization: `Bearer ${this.apiKey}`,
      'Content-Type': 'application/json',
      'User-Agent': '@mainlayer/agentkit/1.0.0',
    }
  }

  private async request<T>(
    method: string,
    path: string,
    body?: unknown,
    params?: Record<string, string | number | boolean>,
  ): Promise<T> {
    let url = `${this.baseUrl}${path}`

    if (params && Object.keys(params).length > 0) {
      const searchParams = new URLSearchParams()
      for (const [key, value] of Object.entries(params)) {
        if (value !== undefined && value !== null) {
          searchParams.set(key, String(value))
        }
      }
      const qs = searchParams.toString()
      if (qs) {
        url = `${url}?${qs}`
      }
    }

    const init: RequestInit = {
      method,
      headers: this.buildHeaders(),
    }

    if (body !== undefined) {
      init.body = JSON.stringify(body)
    }

    let response: Response
    try {
      response = await fetch(url, init)
    } catch (err) {
      throw new Error(
        `Network error contacting Mainlayer API: ${err instanceof Error ? err.message : String(err)}`,
      )
    }

    let responseBody: unknown
    const contentType = response.headers.get('content-type') ?? ''
    if (contentType.includes('application/json')) {
      responseBody = await response.json()
    } else {
      responseBody = await response.text()
    }

    if (!response.ok) {
      const message =
        typeof responseBody === 'object' &&
        responseBody !== null &&
        'message' in responseBody
          ? String((responseBody as Record<string, unknown>).message)
          : `Mainlayer API error ${response.status}`
      throw new MainlayerApiError(message, response.status, responseBody)
    }

    return responseBody as T
  }

  /**
   * Pay for access to a Mainlayer resource.
   */
  async payForResource(
    resourceId: string,
    payerId: string,
  ): Promise<MainlayerPaymentResult> {
    return this.request<MainlayerPaymentResult>('POST', '/v1/payments', {
      resourceId,
      payerId,
    })
  }

  /**
   * Check whether a payer currently has access to a resource.
   */
  async checkAccess(
    resourceId: string,
    payerId: string,
  ): Promise<MainlayerAccessResult> {
    return this.request<MainlayerAccessResult>(
      'GET',
      `/v1/access/${resourceId}`,
      undefined,
      { payerId },
    )
  }

  /**
   * Discover available Mainlayer resources.
   */
  async discoverResources(
    params: MainlayerDiscoverParams = {},
  ): Promise<MainlayerResource[]> {
    const queryParams: Record<string, string | number | boolean> = {}
    if (params.query !== undefined) queryParams.query = params.query
    if (params.limit !== undefined) queryParams.limit = params.limit

    return this.request<MainlayerResource[]>(
      'GET',
      '/v1/resources',
      undefined,
      queryParams,
    )
  }

  /**
   * Create a new Mainlayer resource to monetize a service.
   */
  async createResource(
    params: MainlayerCreateResourceParams,
  ): Promise<MainlayerResource> {
    return this.request<MainlayerResource>('POST', '/v1/resources', params)
  }
}
