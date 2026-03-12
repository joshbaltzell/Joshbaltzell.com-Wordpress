#!/bin/sh
set -e

echo "================================================"
echo "  Quotable — Starting Development Server"
echo "================================================"

# Push database schema (creates/updates tables)
echo ""
echo "Syncing database schema..."
npx drizzle-kit push --force
echo "Database schema synced."

echo ""
echo "Starting Next.js dev server..."
echo "Dashboard: http://localhost:3000"
echo "================================================"

exec npm run dev -- -H 0.0.0.0
