/**
 * Earning Agent Example
 *
 * Demonstrates how to use the Mainlayer AgentKit plugin to:
 * 1. Discover available premium services
 * 2. Pay for access to a paid resource
 * 3. Use verified entitlements in agent workflows
 * 4. Track spending and ROI
 *
 * Usage:
 *   export MAINLAYER_API_KEY="ml_..."
 *   export ANTHROPIC_API_KEY="your-anthropic-key"
 *   npx tsx examples/earning-agent.ts
 */

import { Anthropic } from '@anthropic-ai/sdk'
import { MainlayerClient, MainlayerApiError } from '@mainlayer/agentkit'

async function main() {
  const apiKey = process.env.MAINLAYER_API_KEY
  if (!apiKey) {
    throw new Error('MAINLAYER_API_KEY environment variable is required')
  }

  const client = new MainlayerClient(apiKey)

  console.log('=== Earning Agent Example ===\n')

  // -----------------------------------------------------------------------
  // Step 1: Discover available resources
  // -----------------------------------------------------------------------
  console.log('🔍 Discovering premium services on Mainlayer...')

  try {
    const resources = await client.discoverResources({
      query: '',
      limit: 5,
    })

    console.log(`✓ Found ${resources.length} available resource(s):`)
    resources.forEach((res) => {
      console.log(`  - ${res.name} (${res.id})`)
      console.log(`    Price: $${res.priceUsd} | Model: ${res.feeModel}`)
      if (res.description) {
        console.log(`    Description: ${res.description}`)
      }
    })
    console.log()

    // -----------------------------------------------------------------------
    // Step 2: Select a resource to purchase
    // -----------------------------------------------------------------------
    if (resources.length === 0) {
      console.log('⚠️  No resources found on marketplace.')
      console.log(
        'Create one using a vendor agent, then come back to purchase.\n'
      )
      return
    }

    const selectedResource = resources[0]
    const payerId = 'agent-buyer-' + Date.now()

    console.log(
      `💰 Selected resource: "${selectedResource.name}" (${selectedResource.id})`
    )
    console.log(`   Payer ID: ${payerId}`)
    console.log(`   Price: $${selectedResource.priceUsd}\n`)

    // -----------------------------------------------------------------------
    // Step 3: Check current access status
    // -----------------------------------------------------------------------
    console.log('🔐 Checking current access status...')

    const accessBefore = await client.checkAccess(selectedResource.id, payerId)
    console.log(`  Has access: ${accessBefore.hasAccess}`)
    if (accessBefore.expiresAt) {
      console.log(`  Expires: ${accessBefore.expiresAt}`)
    }
    console.log()

    // -----------------------------------------------------------------------
    // Step 4: Pay for access (if not already granted)
    // -----------------------------------------------------------------------
    if (!accessBefore.hasAccess) {
      console.log('💳 Purchasing access...')

      try {
        const payment = await client.payForResource(selectedResource.id, payerId)

        console.log(`✓ Payment successful!`)
        console.log(`  Payment ID: ${payment.paymentId}`)
        console.log(`  Amount: $${payment.amountUsd}`)
        console.log(`  Paid At: ${payment.paidAt}`)
        console.log()

        // -----------------------------------------------------------------------
        // Step 5: Verify access was granted
        // -----------------------------------------------------------------------
        console.log('🔐 Verifying access after payment...')

        const accessAfter = await client.checkAccess(selectedResource.id, payerId)
        console.log(`  Has access: ${accessAfter.hasAccess}`)
        if (accessAfter.expiresAt) {
          console.log(`  Expires: ${accessAfter.expiresAt}`)
        }
        console.log()
      } catch (err) {
        if (err instanceof MainlayerApiError) {
          console.error(`API Error (HTTP ${err.status}): ${err.message}`)
        } else if (err instanceof Error) {
          console.error(`Error: ${err.message}`)
        } else {
          console.error('Unknown error during payment')
        }
        return
      }
    } else {
      console.log(
        '✓ Agent already has access to this resource (skipping payment)\n'
      )
    }

    // -----------------------------------------------------------------------
    // Step 6: Use Claude to reason about the purchase
    // -----------------------------------------------------------------------
    console.log('🤖 Analyzing purchase with Claude...')

    const anthropic = new Anthropic({
      apiKey: process.env.ANTHROPIC_API_KEY,
    })

    const systemPrompt = `You are a data analyst assistant. An agent just purchased access to a
premium service. Analyze the purchase decision and provide insights on ROI and value.`

    const userMessage = `The agent purchased access to "${selectedResource.name}" for $${selectedResource.priceUsd}.
The service model is "${selectedResource.feeModel}". Should the agent use this resource?`

    const response = await anthropic.messages.create({
      model: 'claude-3-5-sonnet-20241022',
      max_tokens: 500,
      system: systemPrompt,
      messages: [
        {
          role: 'user',
          content: userMessage,
        },
      ],
    })

    console.log('\n📊 Analysis:')
    if (response.content[0].type === 'text') {
      console.log(response.content[0].text)
    }
    console.log()

    // -----------------------------------------------------------------------
    // Step 7: Summary
    // -----------------------------------------------------------------------
    console.log('=== Summary ===')
    console.log(`✓ Discovered ${resources.length} resources`)
    console.log(`✓ Purchased access to: ${selectedResource.name}`)
    console.log(`✓ Cost: $${selectedResource.priceUsd}`)
    console.log(`✓ Entitlement verified and ready to use`)
    console.log()
  } catch (err) {
    if (err instanceof MainlayerApiError) {
      console.error(`API Error (HTTP ${err.status}): ${err.message}`)
    } else if (err instanceof Error) {
      console.error(`Error: ${err.message}`)
    } else {
      console.error('Unexpected error:', err)
    }
    process.exit(1)
  }
}

main()
