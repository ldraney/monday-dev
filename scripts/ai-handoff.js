#!/usr/bin/env node

import 'dotenv/config'
import postgres from 'postgres'
import { readFileSync } from 'fs'

async function generateHandoffContext() {
  console.log('🤖 Generating AI handoff context...\n')
  
  const sql = postgres(process.env.DATABASE_URL || 'postgresql://localhost:5432/monday_dev')
  
  // Get current system state
  const boardStats = await sql`
    SELECT 
      bs.purpose,
      bs.name as board_name,
      bs.id as board_id,
      COUNT(bi.id) as item_count,
      MAX(bi.cached_at) as last_cached
    FROM board_schemas bs
    LEFT JOIN board_items bi ON bs.id = bi.board_id
    WHERE bs.purpose IN ('accounts', 'prod_deals', 'production', 'bulk_batch', 'epo_ingredients', 'epo_materials', 'epo_other')
    GROUP BY bs.purpose, bs.name, bs.id
    ORDER BY bs.purpose
  `
  
  // Get connection summary
  const connections = await sql`
    SELECT 
      bs_source.name as source_board,
      bc.source_column_title,
      bs_target.name as target_board
    FROM board_connections bc
    JOIN board_schemas bs_source ON bc.source_board_id = bs_source.id
    LEFT JOIN board_schemas bs_target ON bc.target_board_id = bs_target.id
    WHERE bs_source.purpose IN ('accounts', 'prod_deals', 'production', 'bulk_batch', 'epo_ingredients', 'epo_materials', 'epo_other')
    ORDER BY bs_source.name
  `
  
  // Priority accounts status
  const priorityAccounts = ['moo elixir', 'evre', 'brickell', 'captain blankenship', 'beauty heroes', 'primally pure']
  
  const accountStatus = {}
  for (const account of priorityAccounts) {
    const accountItems = await sql`
      SELECT bi.name, bs.purpose, bi.id
      FROM board_items bi
      JOIN board_schemas bs ON bi.board_id = bs.id
      WHERE bs.purpose = 'accounts' 
      AND LOWER(bi.name) LIKE ${`%${account.toLowerCase()}%`}
      LIMIT 1
    `
    
    if (accountItems.length > 0) {
      const prodDeals = await sql`
        SELECT COUNT(*) as count
        FROM board_items bi
        JOIN board_schemas bs ON bi.board_id = bs.id
        WHERE bs.purpose = 'prod_deals' 
        AND LOWER(bi.name) LIKE ${`%${account.toLowerCase()}%`}
      `
      
      const production = await sql`
        SELECT COUNT(*) as count
        FROM board_items bi
        JOIN board_schemas bs ON bi.board_id = bs.id
        WHERE bs.purpose = 'production' 
        AND LOWER(bi.name) LIKE ${`%${account.toLowerCase()}%`}
      `
      
      const batches = await sql`
        SELECT COUNT(*) as count
        FROM board_items bi
        JOIN board_schemas bs ON bi.board_id = bs.id
        WHERE bs.purpose = 'bulk_batch' 
        AND LOWER(bi.name) LIKE ${`%${account.toLowerCase()}%`}
      `
      
      accountStatus[account] = {
        account: accountItems[0].name,
        prodDeals: prodDeals[0].count,
        production: production[0].count,
        batches: batches[0].count,
        hasCompleteFlow: prodDeals[0].count > 0 && production[0].count > 0 && batches[0].count > 0
      }
    }
  }
  
  // Current toolkit status
  const toolkitScripts = [
    'map-board-schema.js - Maps Monday.com board structure',
    'cache-items.js - Caches all items locally for fast access',
    'dashboard-cached.js - Instant purchasing pipeline dashboard',
    'purchasing-dashboard.js - API-based dashboard (slower)',
    'ai-handoff.js - Generates context for new AI chats'
  ]
  
  const handoffContext = {
    timestamp: new Date().toISOString(),
    company: "Pure Earth Labs",
    role: "Dev Manager / Purchasing Coordinator",
    
    system_status: {
      boards_mapped: boardStats.length,
      total_items_cached: boardStats.reduce((sum, board) => sum + parseInt(board.item_count), 0),
      last_cache_update: boardStats[0]?.last_cached || 'Never',
      purchasing_pipeline_health: Math.round((Object.values(accountStatus).filter(a => a.hasCompleteFlow).length / Object.keys(accountStatus).length) * 100)
    },
    
    board_summary: boardStats.map(board => ({
      purpose: board.purpose,
      name: board.board_name,
      id: board.board_id,
      items: parseInt(board.item_count),
      url: `https://earthharbor.monday.com/boards/${board.board_id}`
    })),
    
    workflow_connections: connections.length,
    
    priority_accounts: accountStatus,
    
    current_tools: toolkitScripts,
    
    quick_commands: {
      "npm run dashboard-cached": "Instant purchasing pipeline dashboard",
      "npm run cache-items": "Refresh cached data from Monday.com",
      "npm run map-schema": "Re-map board structure and connections",
      "npm run ai-handoff": "Generate new context for AI handoff"
    },
    
    key_findings: [
      `${Object.keys(accountStatus).length} priority accounts tracked`,
      `${Object.values(accountStatus).filter(a => a.hasCompleteFlow).length} accounts have complete purchasing pipelines`,
      `${boardStats.reduce((sum, board) => sum + parseInt(board.item_count), 0)} total items cached locally`,
      "3 EPO boards for ingredient purchasing (Ingredients, Materials, External)",
      "Real Monday.com board connections mapped (not name-based)"
    ],
    
    current_bottlenecks: [
      "Items not connected via Monday.com board relations",
      "Emulsifying wax not found in automated search",
      "Some accounts missing production or batch items",
      "Manual investigation needed for ingredient status"
    ],
    
    next_actions: [
      "Search EPO boards manually for emulsifying wax",
      "Fix board connection linking",
      "Set up automated purchasing alerts",
      "Create weekly purchasing status reports"
    ]
  }
  
  console.log('='.repeat(80))
  console.log('🤖 AI HANDOFF CONTEXT')
  console.log('='.repeat(80))
  console.log(JSON.stringify(handoffContext, null, 2))
  
  console.log('\n='.repeat(80))
  console.log('📋 COPY THIS FOR NEW CLAUDE.AI CHATS')
  console.log('='.repeat(80))
  
  const quickContext = {
    role: "Dev Manager / Purchasing Coordinator at Pure Earth Labs",
    system: "monday-dev toolkit for automating Monday.com purchasing workflows",
    status: `${handoffContext.system_status.total_items_cached} items cached, ${handoffContext.system_status.purchasing_pipeline_health}% pipeline health`,
    boards: "7 boards mapped: Accounts, Prod Deals, Production, Bulk Batch, 3x EPO",
    workflow: "Account → Prod Deal → Production → Bulk Batch → EPO (purchasing)",
    tools: "All scripts use local database cache for instant results",
    current_focus: "Finding emulsifying wax NF status, fixing board connections",
    quick_start: "npm run dashboard-cached"
  }
  
  console.log('```json')
  console.log(JSON.stringify(quickContext, null, 2))
  console.log('```')
  
  console.log('\n🚀 TO START NEW CLAUDE CHAT:')
  console.log('1. Copy the JSON context above')
  console.log('2. Paste into new Claude chat with: "I\'m Lucas from Pure Earth Labs, here\'s my current system context:"')
  console.log('3. Ask Claude to run: npm run dashboard-cached')
  console.log('4. Continue from where you left off!')
  
  await sql.end()
}

async function main() {
  await generateHandoffContext()
}

main()
