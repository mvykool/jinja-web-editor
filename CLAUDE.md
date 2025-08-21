# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

This is a React + TypeScript + Vite application that provides a Jinja template editor with syntax highlighting and autocompletion. The application features two editor variants:

- **Editor** (`/`): Basic CodeMirror editor with Jinja syntax highlighting
- **Opus** (`/opus`): Advanced Jinja editor with custom autocompletion for Jinja templates, tags, filters, variables, and test functions

## Key Technologies

- **Frontend Framework**: React 19 with TypeScript
- **Build Tool**: Vite with SWC for fast refresh
- **Styling**: Tailwind CSS v4
- **Routing**: React Router v7
- **Code Editor**: CodeMirror 6 with Jinja language support
- **Theme**: One Dark theme for the advanced editor

## Development Commands

```bash
# Start development server
npm run dev

# Build for production
npm run build

# Run linter
npm run lint

# Preview production build
npm run preview
```

## Architecture

### Component Structure
- `App.tsx`: Main application with router setup and navigation
- `Editor.tsx`: Basic Jinja editor component
- `Opus.tsx`: Advanced Jinja editor with custom autocompletion logic

### Editor Features (Opus component)
- Context-aware Jinja autocompletion with 135+ filters, template tags, variables, and test functions
- Dark theme with proper syntax highlighting
- Intelligent completion detection for `{% %}` blocks vs `{{ }}` expressions
- Custom completion function that analyzes cursor position and context

### Key Dependencies
- CodeMirror ecosystem: `codemirror`, `@codemirror/*` packages for editor functionality
- Jinja language support: `@codemirror/lang-jinja`
- React ecosystem: `react`, `react-dom`, `react-router-dom`
- Styling: `tailwindcss`, `@tailwindcss/vite`

## Build Configuration

- Uses Vite with React SWC plugin for fast development
- TypeScript configuration split between `tsconfig.app.json` and `tsconfig.node.json`
- ESLint configured with React hooks and refresh plugins
- Tailwind CSS integrated via Vite plugin

## Testing

No test setup is currently configured. The README suggests optional ESLint configuration updates for production applications.
