import { ActionProvider, CreateAction, Network, WalletProvider } from '@coinbase/agentkit'
import { z } from 'zod'
import {
  MainlayerClient,
  MainlayerApiError,
  type MainlayerPaymentResult,
  type MainlayerAccessResult,
  type MainlayerResource,
} from './client.js'

// ---------------------------------------------------------------------------
// Zod schemas
// ---------------------------------------------------------------------------

const PayForResourceSchema = z.object({
  resourceId: z
    .string()
    .min(1, 'resourceId is required')
    .describe('The unique identifier of the Mainlayer resource to pay for'),
  payerId: z
    .string()
    .min(1, 'payerId is required')
    .describe('The identifier of the payer (e.g. agent ID or user ID)'),
})

const CheckAccessSchema = z.object({
  resourceId: z
    .string()
    .min(1, 'resourceId is required')
    .describe('The unique identifier of the Mainlayer resource to check'),
  payerId: z
    .string()
    .min(1, 'payerId is required')
    .describe('The identifier of the payer to verify access for'),
})

const DiscoverResourcesSchema = z.object({
  query: z
    .string()
    .optional()
    .describe('Optional search query to filter resources by name or description'),
  limit: z
    .number()
    .int()
    .positive()
    .max(100)
    .optional()
    .describe('Maximum number of resources to return (1–100, default 20)'),
})

const CreateResourceSchema = z.object({
  name: z
    .string()
    .min(1, 'name is required')
    .describe('The display name for the new resource'),
  priceUsd: z
    .number()
    .positive('priceUsd must be a positive number')
    .describe('Price in USD for accessing this resource'),
  feeModel: z
    .string()
    .min(1, 'feeModel is required')
    .describe(
      'Pricing model for this resource, e.g. "per_request", "subscription_monthly"',
    ),
  description: z
    .string()
    .optional()
    .describe('Optional human-readable description of the resource'),
})

// ---------------------------------------------------------------------------
// Helper — format error for LLM consumption
// ---------------------------------------------------------------------------

function formatError(err: unknown): string {
  if (err instanceof MainlayerApiError) {
    return `Mainlayer API error (HTTP ${err.status}): ${err.message}`
  }
  if (err instanceof Error) {
    return `Error: ${err.message}`
  }
  return `Unexpected error: ${String(err)}`
}

// ---------------------------------------------------------------------------
// Action provider
// ---------------------------------------------------------------------------

/**
 * MainlayerActionProvider integrates the Mainlayer payment platform into
 * Coinbase AgentKit, enabling AI agents to pay for resources, verify access,
 * discover available services, and publish their own monetizable resources.
 */
export class MainlayerActionProvider extends ActionProvider<WalletProvider> {
  private readonly client: MainlayerClient

  constructor(apiKey: string) {
    super('mainlayer', [])
    this.client = new MainlayerClient(apiKey)
  }

  // -------------------------------------------------------------------------
  // mainlayer_pay
  // -------------------------------------------------------------------------

  @CreateAction({
    name: 'mainlayer_pay',
    description:
      'Pay for access to a Mainlayer resource. Use this when an agent needs to purchase ' +
      'access to a paid service or dataset before consuming it.',
    schema: PayForResourceSchema,
  })
  async payForResource(
    walletProvider: WalletProvider,
    args: z.infer<typeof PayForResourceSchema>,
  ): Promise<string> {
    try {
      const result: MainlayerPaymentResult = await this.client.payForResource(
        args.resourceId,
        args.payerId,
      )

      return JSON.stringify({
        success: result.success,
        paymentId: result.paymentId,
        resourceId: result.resourceId,
        payerId: result.payerId,
        amountUsd: result.amountUsd,
        paidAt: result.paidAt,
        message: `Successfully paid $${result.amountUsd.toFixed(2)} for resource ${result.resourceId}. Payment ID: ${result.paymentId}`,
      })
    } catch (err) {
      return JSON.stringify({ success: false, error: formatError(err) })
    }
  }

  // -------------------------------------------------------------------------
  // mainlayer_check_access
  // -------------------------------------------------------------------------

  @CreateAction({
    name: 'mainlayer_check_access',
    description:
      'Check if a user or agent currently has access to a Mainlayer resource. ' +
      'Returns whether access is granted and when it expires (if applicable).',
    schema: CheckAccessSchema,
  })
  async checkAccess(
    walletProvider: WalletProvider,
    args: z.infer<typeof CheckAccessSchema>,
  ): Promise<string> {
    try {
      const result: MainlayerAccessResult = await this.client.checkAccess(
        args.resourceId,
        args.payerId,
      )

      const message = result.hasAccess
        ? `Access granted to resource ${result.resourceId} for payer ${result.payerId}` +
          (result.expiresAt ? `. Expires at: ${result.expiresAt}` : '.')
        : `Access denied to resource ${result.resourceId} for payer ${result.payerId}. Payment may be required.`

      return JSON.stringify({
        hasAccess: result.hasAccess,
        resourceId: result.resourceId,
        payerId: result.payerId,
        expiresAt: result.expiresAt ?? null,
        message,
      })
    } catch (err) {
      return JSON.stringify({ hasAccess: false, error: formatError(err) })
    }
  }

  // -------------------------------------------------------------------------
  // mainlayer_discover
  // -------------------------------------------------------------------------

  @CreateAction({
    name: 'mainlayer_discover',
    description:
      'Discover available Mainlayer resources that agents can pay for and access. ' +
      'Supports optional full-text search and result limiting.',
    schema: DiscoverResourcesSchema,
  })
  async discoverResources(
    walletProvider: WalletProvider,
    args: z.infer<typeof DiscoverResourcesSchema>,
  ): Promise<string> {
    try {
      const resources: MainlayerResource[] = await this.client.discoverResources({
        query: args.query,
        limit: args.limit,
      })

      if (resources.length === 0) {
        return JSON.stringify({
          resources: [],
          count: 0,
          message: args.query
            ? `No resources found matching "${args.query}".`
            : 'No resources are currently available.',
        })
      }

      return JSON.stringify({
        resources,
        count: resources.length,
        message: `Found ${resources.length} resource(s)${args.query ? ` matching "${args.query}"` : ''}.`,
      })
    } catch (err) {
      return JSON.stringify({ resources: [], count: 0, error: formatError(err) })
    }
  }

  // -------------------------------------------------------------------------
  // mainlayer_create_resource
  // -------------------------------------------------------------------------

  @CreateAction({
    name: 'mainlayer_create_resource',
    description:
      'Create a new Mainlayer resource to monetize a service or capability. ' +
      'Use this when an agent wants to publish something other agents can pay for.',
    schema: CreateResourceSchema,
  })
  async createResource(
    walletProvider: WalletProvider,
    args: z.infer<typeof CreateResourceSchema>,
  ): Promise<string> {
    try {
      const resource: MainlayerResource = await this.client.createResource({
        name: args.name,
        priceUsd: args.priceUsd,
        feeModel: args.feeModel,
        description: args.description,
      })

      return JSON.stringify({
        success: true,
        resource,
        message:
          `Resource "${resource.name}" created successfully (ID: ${resource.id}). ` +
          `Price: $${resource.priceUsd.toFixed(2)} / ${resource.feeModel}.`,
      })
    } catch (err) {
      return JSON.stringify({ success: false, error: formatError(err) })
    }
  }

  // -------------------------------------------------------------------------
  // supportsNetwork — Mainlayer is network-agnostic
  // -------------------------------------------------------------------------

  supportsNetwork(_network: Network): boolean {
    return true
  }
}

/**
 * Factory function that creates a MainlayerActionProvider instance.
 * Preferred usage for AgentKit configuration.
 *
 * @example
 * ```typescript
 * import { AgentKit } from '@coinbase/agentkit'
 * import { mainlayerActionProvider } from '@mainlayer/agentkit'
 *
 * const agentKit = await AgentKit.from({
 *   walletProvider,
 *   actionProviders: [mainlayerActionProvider(process.env.MAINLAYER_API_KEY!)],
 * })
 * ```
 */
export const mainlayerActionProvider = (apiKey: string): MainlayerActionProvider =>
  new MainlayerActionProvider(apiKey)
