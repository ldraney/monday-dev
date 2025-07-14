#!/usr/bin/env node

import 'dotenv/config'
import postgres from 'postgres'

const MONDAY_API_URL = 'https://api.monday.com/v2'

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
    return null
  }
  
  return result.data
}

async function initItemsCache() {
  const sql = postgres(process.env.DATABASE_URL || 'postgresql://localhost:5432/monday_dev')
  
  // Create items cache table
  await sql`
    CREATE TABLE IF NOT EXISTS board_items (
      id VARCHAR(50) PRIMARY KEY,
      board_id VARCHAR(50) REFERENCES board_schemas(id),
      name VARCHAR(500) NOT NULL,
      column_data JSONB,
      cached_at TIMESTAMP DEFAULT NOW()
    )
  `
  
  // Create index for fast searching
  await sql`
    CREATE INDEX IF NOT EXISTS idx_board_items_name 
    ON board_items USING gin(to_tsvector('english', name))
  `
  
  await sql`
    CREATE INDEX IF NOT EXISTS idx_board_items_board_id 
    ON board_items (board_id)
  `
  
  return sql
}

async function cacheAllItems() {
  console.log('💾 CACHING ALL MONDAY.COM ITEMS TO LOCAL DATABASE...\n')
  
  const sql = await initItemsCache()
  
  // Get all boards from our schema
  const boards = await sql`
    SELECT id, name, purpose 
    FROM board_schemas 
    WHERE purpose IN ('accounts', 'prod_deals', 'production', 'bulk_batch', 'epo_ingredients', 'epo_materials', 'epo_other')
    ORDER BY purpose
  `
  
  let totalItems = 0
  
  for (const board of boards) {
    console.log(`📊 Caching ${board.name}...`)
    
    const query = `
      query {
        boards(ids: [${board.id}]) {
          items_page(limit: 500) {
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
    
    const data = await queryMonday(query)
    
    if (data && data.boards && data.boards[0]) {
      const items = data.boards[0].items_page.items
      
      // Clear old items for this board
      await sql`DELETE FROM board_items WHERE board_id = ${board.id}`
      
      // Insert new items
      for (const item of items) {
        await sql`
          INSERT INTO board_items (id, board_id, name, column_data)
          VALUES (
            ${item.id}, 
            ${board.id}, 
            ${item.name}, 
            ${JSON.stringify(item.column_values)}
          )
          ON CONFLICT (id) DO UPDATE SET
            name = EXCLUDED.name,
            column_data = EXCLUDED.column_data,
            cached_at = NOW()
        `
      }
      
      console.log(`   ✅ ${items.length} items cached`)
      totalItems += items.length
    } else {
      console.log(`   ❌ Failed to get data for ${board.name}`)
    }
  }
  
  console.log(`\n🎯 CACHE SUMMARY:`)
  console.log(`   Total items cached: ${totalItems}`)
  console.log(`   Last cached: ${new Date().toISOString()}`)
  
  // Show cache stats by board
  const cacheStats = await sql`
    SELECT 
      bs.name as board_name,
      bs.purpose,
      COUNT(bi.id) as item_count,
      MAX(bi.cached_at) as last_cached
    FROM board_schemas bs
    LEFT JOIN board_items bi ON bs.id = bi.board_id
    WHERE bs.purpose IN ('accounts', 'prod_deals', 'production', 'bulk_batch', 'epo_ingredients', 'epo_materials', 'epo_other')
    GROUP BY bs.name, bs.purpose
    ORDER BY item_count DESC
  `
  
  console.log(`\n📊 CACHED BOARDS:`)
  cacheStats.forEach(stat => {
    console.log(`   ${stat.board_name}: ${stat.item_count} items`)
  })
  
  console.log(`\n💡 Next Steps:`)
  console.log(`1. Run: npm run dashboard-cached (for instant results)`)
  console.log(`2. Update cache weekly: npm run cache-items`)
  console.log(`3. Use for AI handoffs: npm run export-context`)
  
  await sql.end()
}

async function main() {
  await cacheAllItems()
}

main()
