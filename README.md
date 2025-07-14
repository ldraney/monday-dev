# monday-dev

**Personal productivity toolkit for working efficiently with Monday.com**

Stop clicking through Monday.com interfaces. Script your workflows, query your data locally, and get work done faster.

## What This Does

monday-dev is a command-line toolkit that helps you:
- **Query your Monday.com data locally** (no API rate limits)
- **Create boards and manage tasks programmatically** 
- **Track your work patterns** (tasks vs tickets, time spent, board connections)
- **Build custom workflows** as you discover them

Built for people who manage work across multiple Monday.com boards and want to move fast.

## Quick Start

```bash
# Setup
npm install
cp .env.example .env
# Add your MONDAY_API_KEY to .env

# Get your Monday.com data locally
createdb monday_dev
npm run get-boards

# Query your boards
npm run find                    # List all boards with IDs
npm run find "CRM"             # Search for specific boards

# Create your personal task tracking board
npm run create-lucas-board     # Creates "Lucas - Tasks & Tickets" board
```

## Core Scripts

### Data Management
- `npm run get-boards` - Sync key workspaces to local PostgreSQL
- `npm run find [search]` - Query boards locally (fast, no API limits)
- `npm run archive-empty` - Archive boards with 0 items

### Board Creation
- `npm run create-lucas-board` - Personal task/ticket tracking board
- (Add more as you build them)

## The Tasks & Tickets System

**Task**: Quick work (< 1 day, just you)
- Daily standups, quick fixes, simple updates

**Ticket**: Complex work (> 1 day, multiple people, needs review)  
- Features, process changes, cross-team coordination

**Your Personal Board** helps you:
1. **Track everything** in one place
2. **Learn time estimation** (estimate vs actual)
3. **See work patterns** (which boards you touch most)
4. **Identify task → ticket transitions** (when simple work becomes complex)

## File Structure

```
monday-dev/
├── scripts/
│   ├── get-boards.js          # Sync Monday.com data to local DB
│   ├── find.js                # Query boards locally  
│   ├── archive-empty.js       # Bulk archive empty boards
│   ├── create-lucas-board.js  # Personal task tracking board
│   └── (your custom scripts)
├── package.json
├── .env.example
└── README.md
```

## Database Schema

Simple PostgreSQL tables:
- **workspaces**: id, name, kind
- **boards**: id, workspace_id, name, state, items_count

All your Monday.com boards cached locally for fast querying and bulk operations.

## Building Your Workflow

**The Pattern:**
1. **Notice repetitive Monday.com work** (creating similar boards, bulk operations)
2. **Write a script** to automate it
3. **Save time, reduce errors**
4. **Build your toolkit over time**

**Examples to build:**
- Board templates for different team members
- Bulk item creation scripts  
- Custom reporting across boards
- Automated board cleanup
- Cross-board data synchronization

## Why This Approach

**Instead of clicking through Monday.com:**
- Query 87 boards instantly with `npm run find`
- Create consistent board structures  
- Track patterns in your work
- Build reusable automation as you discover needs

**Personal productivity first:**
- Prove the system works for you
- Build habits around task/ticket tracking
- Then scale to teams when they see the value

Perfect for managers who work across many boards and want to move faster than the Monday.com interface allows.

---

**Next Steps:**
1. Use your personal board daily for 1-2 weeks
2. Notice patterns and pain points  
3. Write scripts to solve them
4. Build your custom Monday.com workflow toolkit
