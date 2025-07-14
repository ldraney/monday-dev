#!/usr/bin/env node

import 'dotenv/config'

const MONDAY_API_URL = 'https://api.monday.com/v2'

// Board IDs
const ACCOUNTS_BOARD = '9161287533'
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
          settings_str
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

function findItemsContaining(items, searchTerms) {
  return items.filter(item => 
    searchTerms.some(term => 
      item.name.toLowerCase().includes(term.toLowerCase())
    )
  )
}

function showItemDetails(item, boardName) {
  console.log(`\n📋 ${boardName}: ${item.name} (ID: ${item.id})`)
  
  // Show all non-empty column values
  item.column_values.forEach(cv => {
    if (cv.text && cv.text.trim()) {
      console.log(`   ${cv.column.title}: ${cv.text}`)
    }
  })
  
  // Show raw value for connecting columns (might have IDs)
  const connectingColumns = item.column_values.filter(cv => 
    cv.column.title.toLowerCase().includes('connect') ||
    cv.column.title.toLowerCase().includes('link') ||
    cv.column.title.toLowerCase().includes('production') ||
    cv.column.title.toLowerCase().includes('deal') ||
    cv.column.title.toLowerCase().includes('batch') ||
    cv.column.title.toLowerCase().includes('epo')
  )
  
  if (connectingColumns.length > 0) {
    console.log(`   🔗 Connection columns:`)
    connectingColumns.forEach(cv => {
      console.log(`      ${cv.column.title}: text="${cv.text}" value="${cv.value}"`)
    })
  }
}

async function main() {
  console.log('🔍 Deep dive into EVRE and Moo Elixir purchasing flows...\n')
  
  // Get all board data
  const accounts = await getBoardData(ACCOUNTS_BOARD, 'Accounts')
  const prodDeals = await getBoardData(PROD_DEALS_BOARD, 'Prod Deals')
  const production = await getBoardData(PRODUCTION_BOARD, 'Production')
  const batches = await getBoardData(BULK_BATCH_BOARD, 'Bulk Batch Traceability')
  const epos = await getBoardData(EPO_INGREDIENTS_BOARD, 'EPO - Ingredients')
  
  console.log('\n🎯 SEARCHING FOR EVRE AND MOO ELIXIR ACROSS ALL BOARDS...\n')
  
  const searchTerms = ['evre', 'moo elixir', 'moo']
  
  // Find in each board
  const evreItems = {
    accounts: findItemsContaining(accounts.items_page.items, searchTerms),
    prodDeals: findItemsContaining(prodDeals.items_page.items, searchTerms),
    production: findItemsContaining(production.items_page.items, searchTerms),
    batches: findItemsContaining(batches.items_page.items, searchTerms),
    epos: findItemsContaining(epos.items_page.items, searchTerms)
  }
  
  console.log('📊 ITEMS FOUND:')
  console.log(`Accounts: ${evreItems.accounts.length}`)
  console.log(`Prod Deals: ${evreItems.prodDeals.length}`)
  console.log(`Production: ${evreItems.production.length}`)
  console.log(`Bulk Batches: ${evreItems.batches.length}`)
  console.log(`EPO Ingredients: ${evreItems.epos.length}`)
  
  // Show detailed data for each board
  console.log('\n🔍 DETAILED ANALYSIS:\n')
  
  // Accounts
  console.log('='.repeat(60))
  console.log('ACCOUNTS BOARD')
  console.log('='.repeat(60))
  evreItems.accounts.forEach(item => showItemDetails(item, 'Accounts'))
  
  // Prod Deals  
  console.log('\n' + '='.repeat(60))
  console.log('PROD DEALS BOARD')
  console.log('='.repeat(60))
  evreItems.prodDeals.forEach(item => showItemDetails(item, 'Prod Deals'))
  
  // Production
  console.log('\n' + '='.repeat(60))
  console.log('PRODUCTION BOARD')
  console.log('='.repeat(60))
  evreItems.production.forEach(item => showItemDetails(item, 'Production'))
  
  // Bulk Batches
  console.log('\n' + '='.repeat(60))
  console.log('BULK BATCH TRACEABILITY BOARD')
  console.log('='.repeat(60))
  evreItems.batches.forEach(item => showItemDetails(item, 'Bulk Batches'))
  
  // EPO Ingredients
  console.log('\n' + '='.repeat(60))
  console.log('EPO INGREDIENTS BOARD')
  console.log('='.repeat(60))
  evreItems.epos.forEach(item => showItemDetails(item, 'EPO Ingredients'))
  
  console.log('\n🔍 BOARD COLUMN STRUCTURES:\n')
  
  // Show linking columns for each board
  console.log('PROD DEALS COLUMNS:')
  prodDeals.columns.forEach(col => {
    if (col.title.toLowerCase().includes('connect') ||
        col.title.toLowerCase().includes('link') ||
        col.title.toLowerCase().includes('production') ||
        col.title.toLowerCase().includes('batch') ||
        col.title.toLowerCase().includes('account')) {
      console.log(`  🔗 ${col.title} (${col.type})`)
      if (col.settings_str) {
        console.log(`     Settings: ${col.settings_str}`)
      }
    }
  })
  
  console.log('\nPRODUCTION COLUMNS:')
  production.columns.forEach(col => {
    if (col.title.toLowerCase().includes('connect') ||
        col.title.toLowerCase().includes('link') ||
        col.title.toLowerCase().includes('deal') ||
        col.title.toLowerCase().includes('batch') ||
        col.title.toLowerCase().includes('epo')) {
      console.log(`  🔗 ${col.title} (${col.type})`)
      if (col.settings_str) {
        console.log(`     Settings: ${col.settings_str}`)
      }
    }
  })
  
  console.log('\nBULK BATCH COLUMNS:')
  batches.columns.forEach(col => {
    if (col.title.toLowerCase().includes('connect') ||
        col.title.toLowerCase().includes('link') ||
        col.title.toLowerCase().includes('production') ||
        col.title.toLowerCase().includes('epo')) {
      console.log(`  🔗 ${col.title} (${col.type})`)
      if (col.settings_str) {
        console.log(`     Settings: ${col.settings_str}`)
      }
    }
  })
  
  console.log('\n💡 NEXT STEPS:')
  console.log('1. Look for connecting column IDs in the raw values')
  console.log('2. Check if items are linked by Monday.com item IDs rather than names')
  console.log('3. Find the actual connection pattern used in your workflow')
  console.log('4. Update the matching logic to use the real connection method')
}

main()
