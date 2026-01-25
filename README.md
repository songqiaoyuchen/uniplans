# UniPlans

A modern university course planning application built with Next.js, React, and Neo4j. UniPlans helps students visualize course prerequisites, dependencies, and plan their academic journey with an interactive graph-based interface.

## Getting Started

### Prerequisites

- Node.js 18+
- npm or yarn
- Neo4j database (for backend queries)
- Supabase account (for authentication and data storage)

### Installation

1. Clone the repository
2. Install dependencies:
   ```bash
   npm install
   ```

3. Set up environment variables (create `.env.local`):
   ```
   NEXT_PUBLIC_SUPABASE_URL=your_supabase_url
   NEXT_PUBLIC_SUPABASE_ANON_KEY=your_supabase_key
   NEO4J_URI=your_neo4j_uri
   NEO4J_USERNAME=your_neo4j_username
   NEO4J_PASSWORD=your_neo4j_password
   ```

### Running the Development Server

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) in your browser to view the application.

## Project Structure

### `src/app/`

Next.js App Router pages and layouts:
- `page.tsx` — Home page
- `layout.tsx` — Root layout wrapper
- `api/` — Backend API routes
  - `formattedGraph/` — Graph formatting endpoints
  - `modules/` — Module information endpoints
  - `normalisedGraph/` — Normalized graph endpoints
  - `snapshot/` — Snapshot management endpoints
  - `timetable/` — Timetable generation endpoints
- `explore/` — Module exploration interface
- `final-graph/` — Final course graph visualization
- `formatted-graph/` — Formatted graph viewer
- `normalised-graph/` — Normalized graph viewer
- `planner/` — Main course planner interface

### `src/components/`

Reusable React components:
- `layout/` — Layout components (Navbar, etc.)
- `placeholders/` — Loading placeholder components
- `ui/` — Base UI components (ExpandableText, Tag, ThemeToggle, etc.)

### `src/services/`

Client-side API service layer that communicates with backend endpoints:
- `planner/` — Planner-related API calls (fetch graphs, modules, timetables)
- `supabase.ts` — Supabase client configuration

### `src/db/`

Database connection and query layer:
- `neo4j.ts` — Neo4j driver initialization
- `getGraph.ts`, `getModuleByCode.ts`, `getModuleRequires.ts` — Query functions
- `Queries.md` — Documentation of available Cypher queries

### `src/scripts/`

One-time or scheduled utility scripts:
- `neo4j/` — Cypher queries for database operations
- `scrapers/` — Data scrapers (fetches module data from external sources like NUSMods)

### `src/utils/`

Shared utility functions:
- `graph/` — Graph transformation and manipulation utilities
- `planner/` — Planner-specific helper functions

### `src/store/`

Redux state management:
- `apiSlice.ts` — RTK Query API definitions
- `plannerSlice.ts` — Planner state
- `timetableSlice.ts` — Timetable state
- `sidebarSlice.ts` — Sidebar UI state
- `themeSlice.ts` — Theme state

### `src/styles/`

Global styling and theme configuration:
- `globals.css` — Global CSS
- `themes.ts` — MUI theme configuration
- `mui.d.ts` — MUI type definitions

### `src/types/`

TypeScript type definitions:
- `graphTypes.ts` — Graph-related types
- `plannerTypes.ts` — Planner data types
- `neo4jTypes.ts` — Neo4j query result types
- `errorTypes.ts` — Error handling types

### `src/data/`

Static data files:
- `moduleData.json` — Module information
- `miniModuleData.json` — Compact module data
- `modulePrereqInfo.json` — Prerequisite information
- `sampleTimetable.json` — Sample timetable data

### `src/constants/`

Application constants and configuration values

### `src/providers/`

React context providers:
- `ThemeProvider.tsx` — Theme context setup

## Available Scripts

```bash
npm run dev       # Start development server with Turbopack
npm run build     # Build for production
npm start         # Start production server
npm run lint      # Run ESLint
npm run resetDB   # Reset Neo4j database
```

## Database Setup

### Neo4j

The application uses Neo4j for storing course information and prerequisite relationships. Run the reset script to populate the database:

```bash
npm run resetDB
```

This will execute scripts in `src/scripts/neo4j/reset/` to initialize the graph database.

> **Warning**: This command scrapes NUSMods to collect course information. Do not abuse this script as it may violate NUSMods' terms of service.

### Supabase

Supabase is used for authentication and user data persistence. Ensure your environment variables are properly configured.

## 📊 Key Features

- **Interactive Graph Visualization** — Visualize course dependencies and prerequisites
- **Course Planning** — Plan your academic schedule with drag-and-drop interface
- **Timetable Generation** — Automatically generate valid course schedules
- **Dark Mode Support** — Built-in light/dark theme switching
- **Responsive Design** — Works on desktop and mobile devices

## 🛠 Tech Stack

- **Framework** — Next.js 15 with App Router
- **Language** — TypeScript
- **UI Library** — Material-UI (MUI) v7
- **State Management** — Redux Toolkit with RTK Query
- **Database** — Neo4j (graph) + Supabase (relational)
- **Animations** — Framer Motion
- **Graph Visualization** — Cytoscape.js
- **Styling** — Emotion (via MUI)
- **Testing** — Jest

## 📚 Resources

- [Next.js Documentation](https://nextjs.org/docs)
- [Material-UI Documentation](https://mui.com/material-ui/)
- [Neo4j Documentation](https://neo4j.com/docs/)
- [Redux Toolkit Documentation](https://redux-toolkit.js.org/)
