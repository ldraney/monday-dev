#!/usr/bin/env node

import 'dotenv/config'
import postgres from 'postgres'

const MONDAY_API_URL = 'https://api.monday.com/v2'

async function archiveBoard(boardId) {
  const mutation = `
    mutation {
      archive_board (board_id: ${boardId}) {
        id
      }
    }
  `
  
  const response = await fetch(MONDAY_API_URL, {
    method: 'POST',
    headers: {
      'Authorization': process.env.MONDAY_API_KEY,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({ query: mutation })
  })
  
  const result = await response.json()
  
  if (result.errors) {
    console.error(`Failed to archive ${boardId}:`, result.errors[0].message)
    return false
  }
  
  return true
}

async function main() {
  const sql = postgres(process.env.DATABASE_URL || 'postgresql://localhost:5432/monday_dev')
  
  // Find boards with 0 items (excluding subitem boards)
  const emptyBoards = await sql`
    SELECT b.id, b.name, w.name as workspace_name
    FROM boards b
    JOIN workspaces w ON b.workspace_id = w.id
    WHERE b.items_count = 0 
      AND b.state = 'active'
      AND b.name NOT LIKE 'Subitems of %'
    ORDER BY w.name, b.name
  `
  
  if (emptyBoards.length === 0) {
    console.log('No empty boards found!')
    await sql.end()
    return
  }
  
  console.log(`Found ${emptyBoards.length} empty boards:`)
  emptyBoards.forEach(b => {
    console.log(`  ${b.id} - ${b.name} (${b.workspace_name})`)
  })
  
  const args = process.argv.slice(2)
  const confirmed = args.includes('--yes')
  
  if (!confirmed) {
    console.log('\nTo archive these boards, run: npm run archive-empty -- --yes')
    await sql.end()
    return
  }
  
  console.log('\nArchiving empty boards...')
  
  for (const board of emptyBoards) {
    console.log(`Archiving ${board.name}...`)
    
    const success = await archiveBoard(board.id)
    
    if (success) {
      // Update local database
      await sql`
        UPDATE boards 
        SET state = 'archived'
        WHERE id = ${board.id}
      `
      console.log(`  ✅ Archived`)
    } else {
      console.log(`  ❌ Failed`)
    }
  }
  
  console.log('\nDone!')
  await sql.end()
}

main()
