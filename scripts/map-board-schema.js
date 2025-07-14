#!/usr/bin/env node

import 'dotenv/config'
import postgres from 'postgres'

const MONDAY_API_URL = 'https://api.monday.com/v2'

// Core purchasing workflow boards
const CORE_BOARDS = {
  'accounts': '9161287533',
  'prod_deals': '9384243852', 
  'production': '9304930311',
  'bulk_batch': '8768285252',
  'epo_ingredients': '9387127195'
}

// Additional EPO boards we discovered
const ADDITIONAL_EPO_BOARDS = {
  'epo_materials': '9454447162',
  'epo_other': '9454441691'
}

const ALL_BOARDS = { ...CORE_BOARDS, ...ADDITIONAL_EPO_BOARDS }

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

async function getBoardSchema(boardId, boardName) {
  console.log(`📊 Mapping ${boardName} schema...`)
  
  const query = `
    query {
      boards(ids: [${boardId}]) {
        id
        name
        workspace {
          id
          name
        }
        columns {
          id
          title
          type
          width
          settings_str
        }
        items_count
      }
    }
  `
  
  const { boards } = await queryMonday(query)
  return boards[0]
}

function parseConnectionColumns(columns) {
  return columns.filter(col => {
    const isConnection = col.type === 'board_relation' || 
                        col.type === 'mirror' ||
                        col.title.toLowerCase().includes('connect') ||
                        col.title.toLowerCase().includes('link')
    return isConnection
  }).map(col => {
    let connectedBoards = []
    let mirrorInfo = null
    
    if (col.settings_str) {
      try {
        const settings = JSON.parse(col.settings_str)
        if (settings.boardIds) {
          connectedBoards = settings.boardIds
        }
        if (settings.relation_column) {
          mirrorInfo = settings
        }
      } catch (e) {
        // Settings might not be valid JSON
      }
    }
    
    return {
      id: col.id,
      title: col.title,
      type: col.type,
      connectedBoards,
      mirrorInfo,
      settings_str: col.settings_str
    }
  })
}

async function initDatabase() {
  const sql = postgres(process.env.DATABASE_URL || 'postgresql://localhost:5432/monday_dev')
  
  // Create schema mapping tables
  await sql`
    CREATE TABLE IF NOT EXISTS board_schemas (
      id VARCHAR(50) PRIMARY KEY,
      name VARCHAR(255) NOT NULL,
      workspace_id VARCHAR(50),
      workspace_name VARCHAR(255),
      items_count INTEGER,
      purpose VARCHAR(255),
      mapped_at TIMESTAMP DEFAULT NOW()
    )
  `
  
  await sql`
    CREATE TABLE IF NOT EXISTS board_columns (
      id VARCHAR(50) PRIMARY KEY,
      board_id VARCHAR(50) REFERENCES board_schemas(id),
      title VARCHAR(255) NOT NULL,
      type VARCHAR(50),
      width INTEGER,
      settings_str TEXT,
      is_connection BOOLEAN DEFAULT FALSE,
      mapped_at TIMESTAMP DEFAULT NOW()
    )
  `
  
  await sql`
    CREATE TABLE IF NOT EXISTS board_connections (
      id SERIAL PRIMARY KEY,
      source_board_id VARCHAR(50) REFERENCES board_schemas(id),
      source_column_id VARCHAR(50),
      source_column_title VARCHAR(255),
      target_board_id VARCHAR(50),
      connection_type VARCHAR(50), -- 'board_relation', 'mirror'
      is_bidirectional BOOLEAN DEFAULT FALSE,
      mapped_at TIMESTAMP DEFAULT NOW()
    )
  `
  
  return sql
}

async function main() {
  console.log('🗺️  Mapping complete purchasing workflow schema...\n')
  
  const sql = await initDatabase()
  const boardData = {}
  
  // Get schema for all boards
  for (const [name, id] of Object.entries(ALL_BOARDS)) {
    const schema = await getBoardSchema(id, name)
    boardData[name] = schema
    
    // Save board info
    await sql`
      INSERT INTO board_schemas (id, name, workspace_id, workspace_name, items_count, purpose)
      VALUES (
        ${schema.id}, 
        ${schema.name}, 
        ${schema.workspace.id}, 
        ${schema.workspace.name}, 
        ${schema.items_count || 0},
        ${name}
      )
      ON CONFLICT (id) DO UPDATE SET
        name = EXCLUDED.name,
        workspace_name = EXCLUDED.workspace_name,
        items_count = EXCLUDED.items_count,
        mapped_at = NOW()
    `
    
    // Save columns
    for (const col of schema.columns) {
      const isConnection = col.type === 'board_relation' || col.type === 'mirror'
      
      await sql`
        INSERT INTO board_columns (id, board_id, title, type, width, settings_str, is_connection)
        VALUES (
          ${col.id}, 
          ${schema.id}, 
          ${col.title}, 
          ${col.type}, 
          ${col.width || null}, 
          ${col.settings_str || null},
          ${isConnection}
        )
        ON CONFLICT (id) DO UPDATE SET
          title = EXCLUDED.title,
          type = EXCLUDED.type,
          settings_str = EXCLUDED.settings_str,
          is_connection = EXCLUDED.is_connection,
          mapped_at = NOW()
      `
    }
  }
  
  console.log('\n🔗 BOARD CONNECTION ANALYSIS:\n')
  
  // Analyze connections for each board
  for (const [name, schema] of Object.entries(boardData)) {
    console.log(`${'='.repeat(60)}`)
    console.log(`${schema.name.toUpperCase()} (${schema.items_count} items)`)
    console.log(`Workspace: ${schema.workspace.name}`)
    console.log(`${'='.repeat(60)}`)
    
    const connectionColumns = parseConnectionColumns(schema.columns)
    
    if (connectionColumns.length === 0) {
      console.log('❌ No connection columns found')
    } else {
      connectionColumns.forEach(col => {
        console.log(`\n🔗 ${col.title} (${col.type})`)
        
        if (col.connectedBoards.length > 0) {
          console.log(`   Connects to boards: ${col.connectedBoards.join(', ')}`)
          
          // Save connections
          col.connectedBoards.forEach(async (targetBoardId) => {
            await sql`
              INSERT INTO board_connections (
                source_board_id, source_column_id, source_column_title, 
                target_board_id, connection_type
              )
              VALUES (
                ${schema.id}, ${col.id}, ${col.title}, 
                ${targetBoardId}, ${col.type}
              )
              ON CONFLICT DO NOTHING
            `
          })
        }
        
        if (col.mirrorInfo) {
          console.log(`   Mirror settings: ${JSON.stringify(col.mirrorInfo, null, 2)}`)
        }
        
        if (col.settings_str && col.settings_str.length < 200) {
          console.log(`   Settings: ${col.settings_str}`)
        }
      })
    }
    
    // Show all columns by type
    const columnsByType = {}
    schema.columns.forEach(col => {
      if (!columnsByType[col.type]) columnsByType[col.type] = []
      columnsByType[col.type].push(col.title)
    })
    
    console.log(`\n📋 Column Types:`)
    Object.entries(columnsByType).forEach(([type, titles]) => {
      console.log(`   ${type} (${titles.length}): ${titles.slice(0, 3).join(', ')}${titles.length > 3 ? '...' : ''}`)
    })
  }
  
  // Show connection summary
  console.log('\n' + '='.repeat(60))
  console.log('CONNECTION SUMMARY')
  console.log('='.repeat(60))
  
  const connections = await sql`
    SELECT 
      bs_source.name as source_board,
      bc.source_column_title,
      bs_target.name as target_board,
      bc.connection_type
    FROM board_connections bc
    JOIN board_schemas bs_source ON bc.source_board_id = bs_source.id
    LEFT JOIN board_schemas bs_target ON bc.target_board_id = bs_target.id
    ORDER BY bs_source.name, bc.source_column_title
  `
  
  connections.forEach(conn => {
    const targetName = conn.target_board || `Board ${conn.target_board_id || 'Unknown'}`
    console.log(`${conn.source_board} → ${targetName}`)
    console.log(`   via "${conn.source_column_title}" (${conn.connection_type})`)
  })
  
  console.log('\n💾 All schema data saved to local database!')
  console.log('Query with: SELECT * FROM board_schemas; SELECT * FROM board_columns; SELECT * FROM board_connections;')
  
  await sql.end()
}

main()
