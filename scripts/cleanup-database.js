#!/usr/bin/env node

import 'dotenv/config'
import postgres from 'postgres'

async function main() {
  console.log('🧹 Cleaning up database - removing Production 2025 workspace...\n')
  
  const sql = postgres(process.env.DATABASE_URL || 'postgresql://localhost:5432/monday_dev')
  
  // Show what we're about to remove
  const production2025Boards = await sql`
    SELECT b.id, b.name, b.items_count
    FROM boards b
    JOIN workspaces w ON b.workspace_id = w.id
    WHERE w.name = 'Production 2025'
    ORDER BY b.name
  `
  
  console.log(`Found ${production2025Boards.length} boards in Production 2025 workspace:`)
  production2025Boards.forEach(board => {
    console.log(`  ${board.id} - ${board.name} (${board.items_count} items)`)
  })
  
  // Remove the boards first
  await sql`
    DELETE FROM boards 
    WHERE workspace_id IN (
      SELECT id FROM workspaces WHERE name = 'Production 2025'
    )
  `
  
  // Remove the workspace
  await sql`
    DELETE FROM workspaces WHERE name = 'Production 2025'
  `
  
  console.log(`\n✅ Removed ${production2025Boards.length} boards and Production 2025 workspace`)
  
  // Show what's left
  const remainingWorkspaces = await sql`
    SELECT w.name as workspace_name, COUNT(b.id) as board_count
    FROM workspaces w
    LEFT JOIN boards b ON w.id = b.workspace_id
    GROUP BY w.name
    ORDER BY w.name
  `
  
  console.log('\n📊 Remaining workspaces:')
  remainingWorkspaces.forEach(w => {
    console.log(`  ${w.workspace_name}: ${w.board_count} boards`)
  })
  
  // Show all remaining boards
  const remainingBoards = await sql`
    SELECT b.id, b.name, w.name as workspace_name, b.items_count
    FROM boards b
    JOIN workspaces w ON b.workspace_id = w.id
    ORDER BY w.name, b.name
  `
  
  console.log('\n📋 All remaining boards:')
  let currentWorkspace = ''
  remainingBoards.forEach(board => {
    if (board.workspace_name !== currentWorkspace) {
      console.log(`\n${board.workspace_name}:`)
      currentWorkspace = board.workspace_name
    }
    console.log(`  ${board.id} - ${board.name} (${board.items_count} items)`)
  })
  
  await sql.end()
}

main()
