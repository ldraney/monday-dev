#!/usr/bin/env node

import 'dotenv/config'
import postgres from 'postgres'

async function main() {
  const sql = postgres(process.env.DATABASE_URL || 'postgresql://localhost:5432/monday_dev')
  
  const args = process.argv.slice(2)
  const searchTerm = args[0]
  
  if (!searchTerm) {
    // Show all boards
    const boards = await sql`
      SELECT b.id, b.name, w.name as workspace_name, b.items_count
      FROM boards b
      JOIN workspaces w ON b.workspace_id = w.id
      ORDER BY w.name, b.name
    `
    
    console.log('All boards:')
    boards.forEach(b => {
      console.log(`${b.id} - ${b.name} (${b.workspace_name}) - ${b.items_count} items`)
    })
  } else {
    // Search for boards
    const boards = await sql`
      SELECT b.id, b.name, w.name as workspace_name, b.items_count
      FROM boards b
      JOIN workspaces w ON b.workspace_id = w.id
      WHERE b.name ILIKE ${'%' + searchTerm + '%'}
      ORDER BY b.name
    `
    
    console.log(`Boards matching "${searchTerm}":`)
    boards.forEach(b => {
      console.log(`${b.id} - ${b.name} (${b.workspace_name}) - ${b.items_count} items`)
    })
  }
  
  await sql.end()
}

main()
