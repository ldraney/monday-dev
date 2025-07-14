#!/usr/bin/env node

import 'dotenv/config'

const MONDAY_API_URL = 'https://api.monday.com/v2'

// Board IDs
const PROD_DEALS_BOARD = '9384243852'
const PRODUCTION_BOARD = '9304930311' 
const BULK_BATCH_BOARD = '8768285252'
const EPO_INGREDIENTS_BOARD = '9387127195'

async function queryMonday(query) {
  const response = await fetch(MONDAY_API_URL, {
    method: 'POST',
    headers: {
      'Authorization': process.env.MONDAY_API_KEY,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({ query })
  })
  
  const result = await response.json()
  
  if (result.errors) {
    console.error('GraphQL errors:', result.errors)
    process.exit(1)
  }
  
  return result.data
}

async function getBoardData(boardId, boardName) {
  console.log(`📊 Getting ${boardName} data...`)
  
  const query = `
    query {
      boards(ids: [${boardId}]) {
        name
        columns {
          id
          title
          type
        }
        items_page(limit: 200) {
          items {
            id
            name
            column_values {
              column {
                id
                title
              }
              text
              value
            }
          }
        }
      }
    }
  `
  
  const { boards } = await queryMonday(query)
  return boards[0]
}

function findColumnValue(item, searchTerms) {
  return item.column_values.find(cv => 
    searchTerms.some(term => cv.column.title.toLowerCase().includes(term.toLowerCase()))
  )
}

function findMatchingItems(items, searchName) {
  return items.filter(item => 
    item.name.toLowerCase().includes(searchName.toLowerCase()) ||
    searchName.toLowerCase().includes(item.name.toLowerCase())
  )
}

async function main() {
  console.log('🛒 Getting purchasing status for ALL prod deals...\n')
  
  // Get all board data
  const prodDeals = await getBoardData(PROD_DEALS_BOARD, 'Prod Deals')
  const production = await getBoardData(PRODUCTION_BOARD, 'Production')
  const batches = await getBoardData(BULK_BATCH_BOARD, 'Bulk Batch Traceability')
  const epos = await getBoardData(EPO_INGREDIENTS_BOARD, 'EPO - Ingredients')
  
  console.log('\n📈 BOARD SUMMARY:')
  console.log(`Prod Deals: ${prodDeals.items_page.items.length} items`)
  console.log(`Production: ${production.items_page.items.length} items`)
  console.log(`Bulk Batches: ${batches.items_page.items.length} items`)
  console.log(`EPO Ingredients: ${epos.items_page.items.length} items`)
  
  console.log('\n🔍 PURCHASING STATUS BY PROD DEAL:\n')
  
  const dealSummary = {
    totalDeals: 0,
    withProduction: 0,
    withBatches: 0, 
    withEPOs: 0,
    stuckEPOs: 0,
    completeFlow: 0
  }
  
  for (const deal of prodDeals.items_page.items) {
    dealSummary.totalDeals++
    console.log(`📋 ${deal.name}`)
    
    // Check deal status
    const dealStatus = findColumnValue(deal, ['status'])
    if (dealStatus?.text) {
      console.log(`   Status: ${dealStatus.text}`)
    }
    
    // Find connected production items
    const productionMatches = findMatchingItems(production.items_page.items, deal.name)
    
    if (productionMatches.length > 0) {
      dealSummary.withProduction++
      console.log(`   ✅ Production (${productionMatches.length}):`)
      
      productionMatches.forEach(prod => {
        const prodStatus = findColumnValue(prod, ['status'])
        console.log(`      - ${prod.name}: ${prodStatus?.text || 'No Status'}`)
        
        // Find connected batches
        const batchMatches = findMatchingItems(batches.items_page.items, prod.name)
        
        if (batchMatches.length > 0) {
          dealSummary.withBatches++
          console.log(`        🧪 Batches (${batchMatches.length}):`)
          
          batchMatches.forEach(batch => {
            const batchStatus = findColumnValue(batch, ['status'])
            console.log(`           - ${batch.name}: ${batchStatus?.text || 'No Status'}`)
          })
        }
      })
    } else {
      console.log(`   ❌ No production items found`)
    }
    
    // Find EPO ingredients (by deal name, production name, or related terms)
    const epoMatches = epos.items_page.items.filter(epo => {
      const epoName = epo.name.toLowerCase()
      const dealName = deal.name.toLowerCase()
      
      // Look for direct name matches or common terms
      return epoName.includes(dealName) || 
             dealName.includes(epoName) ||
             productionMatches.some(prod => 
               epoName.includes(prod.name.toLowerCase()) ||
               prod.name.toLowerCase().includes(epoName)
             )
    })
    
    if (epoMatches.length > 0) {
      dealSummary.withEPOs++
      console.log(`   🛒 EPO Ingredients (${epoMatches.length}):`)
      
      let hasStuckEPO = false
      epoMatches.forEach(epo => {
        const epoStatus = findColumnValue(epo, ['status'])
        const status = epoStatus?.text || 'No Status'
        const isStuck = status.toLowerCase().includes('pending') || 
                       status.toLowerCase().includes('waiting') || 
                       status.toLowerCase().includes('stuck') ||
                       status === 'No Status'
        
        if (isStuck) hasStuckEPO = true
        
        const statusIcon = isStuck ? '🔴' : '✅'
        console.log(`      ${statusIcon} ${epo.name}: ${status}`)
      })
      
      if (hasStuckEPO) dealSummary.stuckEPOs++
    } else {
      console.log(`   ❌ No EPO ingredients found`)
    }
    
    // Check if complete flow exists
    if (productionMatches.length > 0 && epoMatches.length > 0) {
      dealSummary.completeFlow++
    }
    
    console.log('') // Empty line between deals
  }
  
  console.log('📊 PURCHASING PIPELINE SUMMARY:')
  console.log(`Total Prod Deals: ${dealSummary.totalDeals}`)
  console.log(`With Production: ${dealSummary.withProduction}`)
  console.log(`With Batches: ${dealSummary.withBatches}`)
  console.log(`With EPO Ingredients: ${dealSummary.withEPOs}`)
  console.log(`Complete Flow (Prod + EPO): ${dealSummary.completeFlow}`)
  console.log(`Deals with Stuck EPOs: ${dealSummary.stuckEPOs}`)
  
  console.log('\n🚨 BOTTLENECK ANALYSIS:')
  
  // Find all stuck EPOs
  const allStuckEpos = epos.items_page.items.filter(epo => {
    const statusColumn = findColumnValue(epo, ['status'])
    const status = statusColumn?.text?.toLowerCase() || ''
    return status.includes('pending') || 
           status.includes('waiting') || 
           status.includes('stuck') || 
           status === ''
  })
  
  console.log(`${allStuckEpos.length} total EPO ingredients need attention:`)
  
  // Group stuck EPOs by status
  const stuckByStatus = {}
  allStuckEpos.forEach(epo => {
    const statusColumn = findColumnValue(epo, ['status'])
    const status = statusColumn?.text || 'No Status'
    if (!stuckByStatus[status]) stuckByStatus[status] = []
    stuckByStatus[status].push(epo.name)
  })
  
  Object.entries(stuckByStatus).forEach(([status, epoNames]) => {
    console.log(`\n${status} (${epoNames.length}):`)
    epoNames.slice(0, 5).forEach(name => console.log(`  - ${name}`))
    if (epoNames.length > 5) {
      console.log(`  ... and ${epoNames.length - 5} more`)
    }
  })
  
  console.log('\n💡 NEXT ACTIONS:')
  console.log(`1. Focus on ${dealSummary.stuckEPOs} deals with stuck EPOs`)
  console.log(`2. Create EPO status automation for ${allStuckEpos.length} stuck ingredients`)
  console.log(`3. Link missing production for ${dealSummary.totalDeals - dealSummary.withProduction} deals`)
  console.log(`4. Build purchasing dashboard for real-time monitoring`)
}

main()
