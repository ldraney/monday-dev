#!/usr/bin/env node

import 'dotenv/config'
import postgres from 'postgres'

// Priority accounts to focus on
const PRIORITY_ACCOUNTS = [
  'moo elixir', 'evre', 'brickell', 'captain blankenship', 
  'beauty heroes', 'primally pure', 'earth harbor', 'pure earth labs'
]

async function getAllBoardItemsCached() {
  console.log('💾 Loading data from local cache (instant results)...')
  
  const sql = postgres(process.env.DATABASE_URL || 'postgresql://localhost:5432/monday_dev')
  
  // Get all cached items with board info
  const cachedData = await sql`
    SELECT 
      bs.purpose,
      bs.id as board_id,
      bs.name as board_name,
      bi.id as item_id,
      bi.name as item_name,
      bi.column_data,
      bi.cached_at
    FROM board_schemas bs
    JOIN board_items bi ON bs.id = bi.board_id
    WHERE bs.purpose IN ('accounts', 'prod_deals', 'production', 'bulk_batch', 'epo_ingredients', 'epo_materials', 'epo_other')
    ORDER BY bs.purpose, bi.name
  `
  
  // Group by board purpose
  const allData = {}
  
  cachedData.forEach(row => {
    if (!allData[row.purpose]) {
      allData[row.purpose] = {
        boardId: row.board_id,
        boardName: row.board_name,
        items: []
      }
    }
    
    // Parse column data back to the expected format
    const columnData = row.column_data
    let columnValues = []
    
    if (Array.isArray(columnData)) {
      columnValues = columnData
    } else if (columnData && typeof columnData === 'object') {
      // Handle case where it might be stored differently
      columnValues = []
      console.log(`Warning: Unexpected column_data format for ${row.item_name}:`, typeof columnData)
    } else {
      columnValues = []
    }
    
    allData[row.purpose].items.push({
      id: row.item_id,
      name: row.item_name,
      column_values: Array.isArray(row.column_data) ? row.column_data : []
    })
  })
  
  console.log('   ✅ Loaded from cache instantly!')
  
  await sql.end()
  return allData
}

function findItemsContaining(items, searchTerms) {
  return items.filter(item => 
    searchTerms.some(term => 
      item.name.toLowerCase().includes(term.toLowerCase())
    )
  )
}

function getItemStatus(item) {
  // Safe status extraction with fallback
  if (!item.column_values || !Array.isArray(item.column_values)) {
    return 'Status N/A'
  }
  
  const statusColumn = item.column_values.find(cv => 
    cv && cv.column && cv.column.title &&
    (cv.column.title.toLowerCase().includes('status') ||
     cv.column.title.toLowerCase().includes('stage'))
  )
  return statusColumn?.text || 'No Status'
}

function getBoardUrl(boardId, itemId = null) {
  const baseUrl = `https://earthharbor.monday.com/boards/${boardId}`
  return itemId ? `${baseUrl}/pulses/${itemId}` : baseUrl
}

function searchIngredients(allData, searchTerms) {
  const found = []
  
  // Search across all available EPO boards (find them dynamically)
  const epoBoards = Object.keys(allData).filter(key => key.includes('epo'))
  
  epoBoards.forEach(boardType => {
    if (allData[boardType]) {
      const matches = allData[boardType].items.filter(item => 
        searchTerms.some(term => 
          item.name.toLowerCase().includes(term.toLowerCase())
        )
      )
      
      matches.forEach(item => {
        found.push({
          ...item,
          boardName: allData[boardType].boardName,
          boardId: allData[boardType].boardId,
          boardType
        })
      })
    }
  })
  
  return found
}

async function main() {
  console.log('🚀 PURE EARTH LABS - CACHED PURCHASING DASHBOARD\n')
  console.log('⚡ Using cached data for instant results')
  console.log('🔄 To refresh cache: npm run cache-items\n')
  
  const allData = await getAllBoardItemsCached()
  
  console.log('📊 BOARD SUMMARY:')
  Object.entries(allData).forEach(([purpose, data]) => {
    const url = getBoardUrl(data.boardId)
    console.log(`   ${data.boardName}: ${data.items.length} items`)
    console.log(`   🔗 ${url}`)
  })
  
  console.log('\n' + '='.repeat(80))
  console.log('🎯 PRIORITY ACCOUNTS PURCHASING STATUS')
  console.log('='.repeat(80))
  
  const accountSummary = []
  
  // Process each priority account
  for (const accountName of PRIORITY_ACCOUNTS) {
    console.log(`\n📋 ${accountName.toUpperCase()}:`)
    
    // Find account
    const accounts = findItemsContaining(allData.accounts?.items || [], [accountName])
    
    if (accounts.length === 0) {
      console.log('   ❌ Account not found')
      continue
    }
    
    const account = accounts[0]
    const accountUrl = getBoardUrl(allData.accounts.boardId, account.id)
    console.log(`   🏢 Account: ${account.name}`)
    console.log(`   🔗 ${accountUrl}`)
    
    // Find prod deals
    const prodDeals = findItemsContaining(allData.prod_deals?.items || [], [accountName])
    console.log(`   📝 Prod Deals: ${prodDeals.length}`)
    
    prodDeals.forEach(deal => {
      const dealUrl = getBoardUrl(allData.prod_deals.boardId, deal.id)
      const status = getItemStatus(deal)
      console.log(`      - ${deal.name}: ${status}`)
      console.log(`        🔗 ${dealUrl}`)
    })
    
    // Find production items
    const production = findItemsContaining(allData.production?.items || [], [accountName])
    console.log(`   🏭 Production: ${production.length}`)
    
    production.forEach(prod => {
      const prodUrl = getBoardUrl(allData.production.boardId, prod.id)
      const status = getItemStatus(prod)
      console.log(`      - ${prod.name}: ${status}`)
      console.log(`        🔗 ${prodUrl}`)
    })
    
    // Find bulk batches
    const batches = findItemsContaining(allData.bulk_batch?.items || [], [accountName])
    console.log(`   🧪 Bulk Batches: ${batches.length}`)
    
    batches.forEach(batch => {
      const batchUrl = getBoardUrl(allData.bulk_batch.boardId, batch.id)
      const status = getItemStatus(batch)
      console.log(`      - ${batch.name}: ${status}`)
      console.log(`        🔗 ${batchUrl}`)
    })
    
    // Summary for this account
    accountSummary.push({
      name: accountName,
      accounts: accounts.length,
      prodDeals: prodDeals.length,
      production: production.length,
      batches: batches.length,
      hasCompleteFlow: accounts.length > 0 && prodDeals.length > 0 && production.length > 0
    })
  }
  
  console.log('\n' + '='.repeat(80))
  console.log('🔍 INGREDIENT SEARCH - EMULSIFYING WAX')
  console.log('='.repeat(80))
  
  // Search for emulsifying wax with MUCH broader terms
  const emulsifyingTerms = [
    'emulsifying', 'wax', 'cetearyl', 'emulsifier', 'polawax', 
    'BTMS', 'conditioning', 'stearyl', 'cetyl', 'emulsi', 
    'wax nf', 'nf', 'conditioning wax', 'emulsify'
  ]
  
  const emulsifyingWaxItems = searchIngredients(allData, emulsifyingTerms)
  
  if (emulsifyingWaxItems.length > 0) {
    console.log(`\n✅ Found ${emulsifyingWaxItems.length} potential emulsifying wax items:`)
    
    emulsifyingWaxItems.forEach(item => {
      const status = getItemStatus(item)
      const itemUrl = getBoardUrl(item.boardId, item.id)
      console.log(`\n🛒 ${item.name}`)
      console.log(`   Board: ${item.boardName}`)
      console.log(`   Status: ${status}`)
      console.log(`   🔗 ${itemUrl}`)
      
      // Show any connections to clients (safely)
      const connectionColumns = (item.column_values || []).filter(cv => 
        cv && cv.text && cv.text.trim() && cv.text !== 'null' && cv.column &&
        (cv.column.title.toLowerCase().includes('production') ||
         cv.column.title.toLowerCase().includes('deal') ||
         cv.column.title.toLowerCase().includes('batch') ||
         cv.column.title.toLowerCase().includes('link'))
      )
      
      if (connectionColumns.length > 0) {
        console.log('   🔗 Connected to:')
        connectionColumns.forEach(cv => {
          console.log(`      ${cv.column.title}: ${cv.text}`)
        })
      }
    })
  } else {
    console.log('\n❌ No emulsifying wax items found with search terms:')
    console.log(`   ${emulsifyingTerms.join(', ')}`)
    
    console.log('\n🔍 Manual investigation needed - check these EPO boards:')
    
    // Find all EPO boards dynamically
    const epoBoards = Object.keys(allData).filter(key => key.includes('epo'))
    
    epoBoards.forEach(boardType => {
      if (allData[boardType]) {
        const url = getBoardUrl(allData[boardType].boardId)
        console.log(`\n📋 ${allData[boardType].boardName} (${allData[boardType].items.length} items):`)
        console.log(`   🔗 ${url}`)
        
        // Show first 10 items as examples
        console.log('   Sample items:')
        allData[boardType].items.slice(0, 10).forEach(item => {
          console.log(`      - ${item.name}`)
        })
        if (allData[boardType].items.length > 10) {
          console.log(`      ... and ${allData[boardType].items.length - 10} more`)
        }
      }
    })
  }
  
  console.log('\n' + '='.repeat(80))
  console.log('📈 OVERALL PURCHASING PIPELINE STATUS')
  console.log('='.repeat(80))
  
  const totalAccounts = accountSummary.length
  const accountsWithCompleteFlow = accountSummary.filter(a => a.hasCompleteFlow).length
  const totalProdDeals = accountSummary.reduce((sum, a) => sum + a.prodDeals, 0)
  const totalProduction = accountSummary.reduce((sum, a) => sum + a.production, 0)
  const totalBatches = accountSummary.reduce((sum, a) => sum + a.batches, 0)
  
  console.log(`\n📊 Summary:`)
  console.log(`   Priority Accounts: ${totalAccounts}`)
  console.log(`   Complete Flows: ${accountsWithCompleteFlow}`)
  console.log(`   Total Prod Deals: ${totalProdDeals}`)
  console.log(`   Total Production: ${totalProduction}`)
  console.log(`   Total Batches: ${totalBatches}`)
  console.log(`   Emulsifying Wax Items: ${emulsifyingWaxItems.length}`)
  
  console.log(`\n🎯 Pipeline Health: ${Math.round((accountsWithCompleteFlow / totalAccounts) * 100)}%`)
  
  // Show accounts needing attention
  const incompleteAccounts = accountSummary.filter(a => !a.hasCompleteFlow)
  if (incompleteAccounts.length > 0) {
    console.log(`\n⚠️  Accounts needing attention:`)
    incompleteAccounts.forEach(account => {
      console.log(`   ${account.name}: missing production or batches`)
    })
  }
  
  console.log('\n💡 QUICK INVESTIGATION LINKS:')
  console.log('   📋 All Boards: https://earthharbor.monday.com/')
  console.log('   🛒 EPO Ingredients: https://earthharbor.monday.com/boards/9387127195')
  console.log('   🔧 EPO Materials: https://earthharbor.monday.com/boards/9454447162') 
  console.log('   📦 EPO External: https://earthharbor.monday.com/boards/9454441691')
  
  console.log('\n🚀 NEXT STEPS:')
  console.log('1. Click EPO board links above to manually search for emulsifying wax')
  console.log('2. Check if items need to be linked via board relations')
  console.log('3. Run this dashboard daily to monitor purchasing pipeline health')
  console.log('4. Refresh cache weekly: npm run cache-items')
}

main()
