import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { MainlayerActionProvider, mainlayerActionProvider } from '../src/mainlayer-action-provider.js'
import { MainlayerClient, MainlayerApiError } from '../src/client.js'

// ---------------------------------------------------------------------------
// Mocks
// ---------------------------------------------------------------------------

vi.mock('../src/client.js', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../src/client.js')>()
  return {
    ...actual,
    MainlayerClient: vi.fn(),
  }
})

const mockWalletProvider = {} as any
const MockedMainlayerClient = vi.mocked(MainlayerClient)

function buildMockClient() {
  return {
    payForResource: vi.fn(),
    checkAccess: vi.fn(),
    discoverResources: vi.fn(),
    createResource: vi.fn(),
  }
}

function parseResult(result: string) {
  return JSON.parse(result)
}

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

const PAYMENT_RESULT = {
  success: true,
  paymentId: 'pay_abc123',
  resourceId: 'res_xyz',
  payerId: 'payer_1',
  amountUsd: 9.99,
  paidAt: '2026-03-30T12:00:00Z',
}

const ACCESS_RESULT_GRANTED = {
  hasAccess: true,
  resourceId: 'res_xyz',
  payerId: 'payer_1',
  expiresAt: '2026-04-30T12:00:00Z',
}

const ACCESS_RESULT_DENIED = {
  hasAccess: false,
  resourceId: 'res_xyz',
  payerId: 'payer_1',
}

const RESOURCES = [
  {
    id: 'res_1',
    name: 'Premium Data Feed',
    description: 'Real-time market data',
    priceUsd: 4.99,
    feeModel: 'per_request',
    createdAt: '2026-01-01T00:00:00Z',
    updatedAt: '2026-01-01T00:00:00Z',
  },
  {
    id: 'res_2',
    name: 'NLP Analysis API',
    description: 'Advanced text processing',
    priceUsd: 19.99,
    feeModel: 'subscription_monthly',
    createdAt: '2026-02-01T00:00:00Z',
    updatedAt: '2026-02-01T00:00:00Z',
  },
]

const CREATED_RESOURCE = {
  id: 'res_new',
  name: 'My Service',
  priceUsd: 2.5,
  feeModel: 'per_request',
  createdAt: '2026-03-30T12:00:00Z',
  updatedAt: '2026-03-30T12:00:00Z',
}

// ---------------------------------------------------------------------------
// Suite
// ---------------------------------------------------------------------------

describe('MainlayerActionProvider', () => {
  let provider: MainlayerActionProvider
  let mockClient: ReturnType<typeof buildMockClient>

  beforeEach(() => {
    mockClient = buildMockClient()
    MockedMainlayerClient.mockImplementation(() => mockClient as any)
    provider = new MainlayerActionProvider('test-api-key')
  })

  afterEach(() => {
    vi.clearAllMocks()
  })

  // -------------------------------------------------------------------------
  // Constructor / factory
  // -------------------------------------------------------------------------

  describe('constructor and factory', () => {
    it('creates a provider with the correct name', () => {
      expect(provider.name).toBe('mainlayer')
    })

    it('instantiates MainlayerClient with the provided API key', () => {
      expect(MockedMainlayerClient).toHaveBeenCalledWith('test-api-key')
    })

    it('mainlayerActionProvider factory returns a MainlayerActionProvider instance', () => {
      const instance = mainlayerActionProvider('another-key')
      expect(instance).toBeInstanceOf(MainlayerActionProvider)
    })

    it('factory passes the API key to the underlying client', () => {
      mainlayerActionProvider('factory-key')
      expect(MockedMainlayerClient).toHaveBeenCalledWith('factory-key')
    })
  })

  // -------------------------------------------------------------------------
  // supportsNetwork
  // -------------------------------------------------------------------------

  describe('supportsNetwork', () => {
    it('returns true for any network', () => {
      expect(provider.supportsNetwork({ protocolFamily: 'evm', chainId: '1' } as any)).toBe(true)
      expect(provider.supportsNetwork({ protocolFamily: 'svm' } as any)).toBe(true)
      expect(provider.supportsNetwork({} as any)).toBe(true)
    })
  })

  // -------------------------------------------------------------------------
  // payForResource
  // -------------------------------------------------------------------------

  describe('payForResource', () => {
    it('returns a success result with payment details', async () => {
      mockClient.payForResource.mockResolvedValue(PAYMENT_RESULT)

      const raw = await provider.payForResource(mockWalletProvider, {
        resourceId: 'res_xyz',
        payerId: 'payer_1',
      })

      const result = parseResult(raw)
      expect(result.success).toBe(true)
      expect(result.paymentId).toBe('pay_abc123')
      expect(result.amountUsd).toBe(9.99)
      expect(result.message).toContain('$9.99')
    })

    it('calls the client with correct arguments', async () => {
      mockClient.payForResource.mockResolvedValue(PAYMENT_RESULT)

      await provider.payForResource(mockWalletProvider, {
        resourceId: 'res_xyz',
        payerId: 'payer_1',
      })

      expect(mockClient.payForResource).toHaveBeenCalledWith('res_xyz', 'payer_1')
    })

    it('returns an error result on MainlayerApiError (402)', async () => {
      mockClient.payForResource.mockRejectedValue(
        new MainlayerApiError('Payment required', 402, { code: 'payment_required' }),
      )

      const raw = await provider.payForResource(mockWalletProvider, {
        resourceId: 'res_xyz',
        payerId: 'payer_1',
      })

      const result = parseResult(raw)
      expect(result.success).toBe(false)
      expect(result.error).toContain('HTTP 402')
    })

    it('returns an error result on network failure', async () => {
      mockClient.payForResource.mockRejectedValue(new Error('Network timeout'))

      const raw = await provider.payForResource(mockWalletProvider, {
        resourceId: 'res_xyz',
        payerId: 'payer_1',
      })

      const result = parseResult(raw)
      expect(result.success).toBe(false)
      expect(result.error).toContain('Network timeout')
    })

    it('result message includes resource and payment IDs', async () => {
      mockClient.payForResource.mockResolvedValue(PAYMENT_RESULT)

      const raw = await provider.payForResource(mockWalletProvider, {
        resourceId: 'res_xyz',
        payerId: 'payer_1',
      })

      const result = parseResult(raw)
      expect(result.message).toContain('res_xyz')
      expect(result.message).toContain('pay_abc123')
    })
  })

  // -------------------------------------------------------------------------
  // checkAccess
  // -------------------------------------------------------------------------

  describe('checkAccess', () => {
    it('returns hasAccess true when access is granted', async () => {
      mockClient.checkAccess.mockResolvedValue(ACCESS_RESULT_GRANTED)

      const raw = await provider.checkAccess(mockWalletProvider, {
        resourceId: 'res_xyz',
        payerId: 'payer_1',
      })

      const result = parseResult(raw)
      expect(result.hasAccess).toBe(true)
      expect(result.expiresAt).toBe('2026-04-30T12:00:00Z')
    })

    it('returns hasAccess false when access is denied', async () => {
      mockClient.checkAccess.mockResolvedValue(ACCESS_RESULT_DENIED)

      const raw = await provider.checkAccess(mockWalletProvider, {
        resourceId: 'res_xyz',
        payerId: 'payer_1',
      })

      const result = parseResult(raw)
      expect(result.hasAccess).toBe(false)
      expect(result.expiresAt).toBeNull()
    })

    it('calls the client with correct arguments', async () => {
      mockClient.checkAccess.mockResolvedValue(ACCESS_RESULT_GRANTED)

      await provider.checkAccess(mockWalletProvider, {
        resourceId: 'res_xyz',
        payerId: 'payer_1',
      })

      expect(mockClient.checkAccess).toHaveBeenCalledWith('res_xyz', 'payer_1')
    })

    it('access-denied message mentions payment may be required', async () => {
      mockClient.checkAccess.mockResolvedValue(ACCESS_RESULT_DENIED)

      const raw = await provider.checkAccess(mockWalletProvider, {
        resourceId: 'res_xyz',
        payerId: 'payer_1',
      })

      const result = parseResult(raw)
      expect(result.message).toMatch(/payment may be required/i)
    })

    it('returns an error result on API failure', async () => {
      mockClient.checkAccess.mockRejectedValue(
        new MainlayerApiError('Unauthorized', 401, {}),
      )

      const raw = await provider.checkAccess(mockWalletProvider, {
        resourceId: 'res_xyz',
        payerId: 'payer_1',
      })

      const result = parseResult(raw)
      expect(result.hasAccess).toBe(false)
      expect(result.error).toContain('HTTP 401')
    })
  })

  // -------------------------------------------------------------------------
  // discoverResources
  // -------------------------------------------------------------------------

  describe('discoverResources', () => {
    it('returns a list of resources', async () => {
      mockClient.discoverResources.mockResolvedValue(RESOURCES)

      const raw = await provider.discoverResources(mockWalletProvider, {})
      const result = parseResult(raw)

      expect(result.count).toBe(2)
      expect(result.resources).toHaveLength(2)
      expect(result.resources[0].id).toBe('res_1')
    })

    it('passes query and limit to the client', async () => {
      mockClient.discoverResources.mockResolvedValue([RESOURCES[0]])

      await provider.discoverResources(mockWalletProvider, {
        query: 'data',
        limit: 10,
      })

      expect(mockClient.discoverResources).toHaveBeenCalledWith({
        query: 'data',
        limit: 10,
      })
    })

    it('returns a helpful message when no resources found', async () => {
      mockClient.discoverResources.mockResolvedValue([])

      const raw = await provider.discoverResources(mockWalletProvider, {
        query: 'nonexistent',
      })

      const result = parseResult(raw)
      expect(result.count).toBe(0)
      expect(result.message).toContain('"nonexistent"')
    })

    it('returns a message when no resources available at all', async () => {
      mockClient.discoverResources.mockResolvedValue([])

      const raw = await provider.discoverResources(mockWalletProvider, {})
      const result = parseResult(raw)

      expect(result.message).toMatch(/no resources/i)
    })

    it('includes query term in the result message', async () => {
      mockClient.discoverResources.mockResolvedValue(RESOURCES)

      const raw = await provider.discoverResources(mockWalletProvider, {
        query: 'premium',
      })

      const result = parseResult(raw)
      expect(result.message).toContain('"premium"')
    })

    it('returns an error result on API failure', async () => {
      mockClient.discoverResources.mockRejectedValue(new Error('Service unavailable'))

      const raw = await provider.discoverResources(mockWalletProvider, {})
      const result = parseResult(raw)

      expect(result.count).toBe(0)
      expect(result.error).toContain('Service unavailable')
    })
  })

  // -------------------------------------------------------------------------
  // createResource
  // -------------------------------------------------------------------------

  describe('createResource', () => {
    it('returns success with the created resource', async () => {
      mockClient.createResource.mockResolvedValue(CREATED_RESOURCE)

      const raw = await provider.createResource(mockWalletProvider, {
        name: 'My Service',
        priceUsd: 2.5,
        feeModel: 'per_request',
      })

      const result = parseResult(raw)
      expect(result.success).toBe(true)
      expect(result.resource.id).toBe('res_new')
      expect(result.resource.name).toBe('My Service')
    })

    it('calls the client with all provided fields', async () => {
      mockClient.createResource.mockResolvedValue(CREATED_RESOURCE)

      await provider.createResource(mockWalletProvider, {
        name: 'My Service',
        priceUsd: 2.5,
        feeModel: 'per_request',
        description: 'A test service',
      })

      expect(mockClient.createResource).toHaveBeenCalledWith({
        name: 'My Service',
        priceUsd: 2.5,
        feeModel: 'per_request',
        description: 'A test service',
      })
    })

    it('result message includes resource name and ID', async () => {
      mockClient.createResource.mockResolvedValue(CREATED_RESOURCE)

      const raw = await provider.createResource(mockWalletProvider, {
        name: 'My Service',
        priceUsd: 2.5,
        feeModel: 'per_request',
      })

      const result = parseResult(raw)
      expect(result.message).toContain('My Service')
      expect(result.message).toContain('res_new')
    })

    it('result message includes formatted price', async () => {
      mockClient.createResource.mockResolvedValue(CREATED_RESOURCE)

      const raw = await provider.createResource(mockWalletProvider, {
        name: 'My Service',
        priceUsd: 2.5,
        feeModel: 'per_request',
      })

      const result = parseResult(raw)
      expect(result.message).toContain('$2.50')
    })

    it('returns an error result on conflict (409)', async () => {
      mockClient.createResource.mockRejectedValue(
        new MainlayerApiError('Resource name already exists', 409, {}),
      )

      const raw = await provider.createResource(mockWalletProvider, {
        name: 'My Service',
        priceUsd: 2.5,
        feeModel: 'per_request',
      })

      const result = parseResult(raw)
      expect(result.success).toBe(false)
      expect(result.error).toContain('HTTP 409')
    })

    it('returns an error result on unexpected error', async () => {
      mockClient.createResource.mockRejectedValue('something weird')

      const raw = await provider.createResource(mockWalletProvider, {
        name: 'My Service',
        priceUsd: 2.5,
        feeModel: 'per_request',
      })

      const result = parseResult(raw)
      expect(result.success).toBe(false)
      expect(result.error).toBeDefined()
    })
  })
})
