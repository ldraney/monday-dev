#!/usr/bin/env node

import 'dotenv/config'
import postgres from 'postgres'

async function main() {
  console.log('🔍 VALIDATING PURCHASING WORKFLOW SCHEMA MAPPING...\n')
  
  const sql = postgres(process.env.DATABASE_URL || 'postgresql://localhost:5432/monday_dev')
  
  // 1. Verify we captured all expected boards
  console.log('📊 CAPTURED BOARDS:')
  const boards = await sql`
    SELECT id, name, workspace_name, items_count, purpose
    FROM board_schemas 
    ORDER BY purpose
  `
  
  boards.forEach(board => {
    console.log(`✅ ${board.purpose}: ${board.name} (${board.items_count} items)`)
    console.log(`   ID: ${board.id} | Workspace: ${board.workspace_name}`)
  })
  
  // 2. Show connection columns for each board
  console.log('\n🔗 CONNECTION COLUMNS BY BOARD:')
  const connectionColumns = await sql`
    SELECT 
      bs.name as board_name,
      bc.title as column_title,
      bc.type as column_type,
      bc.settings_str
    FROM board_columns bc
    JOIN board_schemas bs ON bc.board_id = bs.id
    WHERE bc.is_connection = true
    ORDER BY bs.name, bc.title
  `
  
  let currentBoard = ''
  connectionColumns.forEach(col => {
    if (col.board_name !== currentBoard) {
      console.log(`\n📋 ${col.board_name}:`)
      currentBoard = col.board_name
    }
    console.log(`   🔗 ${col.column_title} (${col.column_type})`)
    
    // Parse settings to show target boards
    if (col.settings_str) {
      try {
        const settings = JSON.parse(col.settings_str)
        if (settings.boardIds) {
          console.log(`      → Targets: ${settings.boardIds.join(', ')}`)
        }
      } catch (e) {
        // Settings might not be JSON
      }
    }
  })
  
  // 3. Show the mapped connections
  console.log('\n🛤️  MAPPED WORKFLOW CONNECTIONS:')
  const connections = await sql`
    SELECT 
      bs_source.name as source_board,
      bc.source_column_title,
      bs_target.name as target_board,
      bc.connection_type,
      bc.target_board_id
    FROM board_connections bc
    JOIN board_schemas bs_source ON bc.source_board_id = bs_source.id
    LEFT JOIN board_schemas bs_target ON bc.target_board_id = bs_target.id
    ORDER BY 
      CASE bs_source.purpose
        WHEN 'accounts' THEN 1
        WHEN 'prod_deals' THEN 2  
        WHEN 'production' THEN 3
        WHEN 'bulk_batch' THEN 4
        ELSE 5
      END,
      bc.source_column_title
  `
  
  connections.forEach(conn => {
    const targetName = conn.target_board || `Board ${conn.target_board_id}`
    console.log(`${conn.source_board}`)
    console.log(`   └─ "${conn.source_column_title}" → ${targetName} (${conn.connection_type})`)
  })
  
  // 4. Validate we can trace the complete workflow
  console.log('\n🔄 COMPLETE WORKFLOW PATH VALIDATION:')
  
  // Check each step of the workflow
  const workflowSteps = [
    { from: 'accounts', to: 'prod_deals', description: 'Accounts → Prod Deals' },
    { from: 'prod_deals', to: 'production', description: 'Prod Deals → Production' },
    { from: 'production', to: 'bulk_batch', description: 'Production → Bulk Batches' },
    { from: 'bulk_batch', to: 'epo_ingredients', description: 'Bulk Batches → EPO Ingredients' }
  ]
  
  for (const step of workflowSteps) {
    const pathExists = await sql`
      SELECT COUNT(*) as count
      FROM board_connections bc
      JOIN board_schemas bs_source ON bc.source_board_id = bs_source.id
      JOIN board_schemas bs_target ON bc.target_board_id = bs_target.id
      WHERE bs_source.purpose = ${step.from} AND bs_target.purpose = ${step.to}
    `
    
    const hasPath = pathExists[0].count > 0
    console.log(`${hasPath ? '✅' : '❌'} ${step.description}`)
  }
  
  // 5. Check for all EPO boards
  console.log('\n🧪 EPO BOARD COVERAGE:')
  const epoBoards = await sql`
    SELECT name, id, items_count
    FROM board_schemas 
    WHERE name ILIKE '%epo%' OR purpose LIKE '%epo%'
    ORDER BY name
  `
  
  epoBoards.forEach(board => {
    console.log(`✅ ${board.name} (${board.items_count} items) - ID: ${board.id}`)
  })
  
  // 6. Show column type distribution
  console.log('\n📈 COLUMN TYPE ANALYSIS:')
  const columnStats = await sql`
    SELECT 
      bc.type,
      COUNT(*) as count,
      COUNT(CASE WHEN bc.is_connection THEN 1 END) as connection_count
    FROM board_columns bc
    GROUP BY bc.type
    ORDER BY count DESC
  `
  
  columnStats.forEach(stat => {
    const connectionPart = stat.connection_count > 0 ? ` (${stat.connection_count} connections)` : ''
    console.log(`   ${stat.type}: ${stat.count} columns${connectionPart}`)
  })
  
  // 7. Summary validation
  console.log('\n🎯 VALIDATION SUMMARY:')
  
  const totalBoards = boards.length
  const totalConnections = connections.length
  const totalColumns = await sql`SELECT COUNT(*) as count FROM board_columns`
  const connectionColumnsCount = await sql`SELECT COUNT(*) as count FROM board_columns WHERE is_connection = true`
  
  console.log(`✅ Captured ${totalBoards} boards`)
  console.log(`✅ Mapped ${totalColumns[0].count} total columns`)
  console.log(`✅ Found ${connectionColumnsCount[0].count} connection columns`)
  console.log(`✅ Traced ${totalConnections} board relationships`)
  
  // 8. What we can now do
  console.log('\n🚀 WHAT WE CAN NOW DO:')
  console.log('✅ Follow real Monday.com board relations (not name matching)')
  console.log('✅ Query all EPO boards for ingredient status')
  console.log('✅ Trace complete purchasing flows for any client')
  console.log('✅ Find bottlenecks in the actual workflow')
  console.log('✅ Build automation using real connection IDs')
  
  console.log('\n💡 NEXT STEPS:')
  console.log('1. Write script to follow board_relation values for real connections')
  console.log('2. Query all EPO boards to find emulsifying wax for Moo Elixir')
  console.log('3. Build purchasing status dashboard using real workflow')
  console.log('4. Create alerts for stuck purchasing items')
  
  await sql.end()
}

main()
