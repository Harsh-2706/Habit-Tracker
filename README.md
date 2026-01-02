Habit Tracker Pro 🚀

Professional local-first habit tracker built with vanilla HTML/CSS/JavaScript. Modern glassmorphism UI, fully responsive, PWA-ready, perfect for SRM University AI/ML portfolios.

✨ Features
✅ Habit CRUD (Create/Edit/Archive/Delete)
✅ Monthly Calendar + Daily Logging  
✅ Streaks, Stats, Completion Rates
✅ Search/Filter + JSON/CSV Export
✅ Dark/Light Theme Toggle
✅ Browser Notifications (optional)
✅ Keyboard Shortcuts + Mobile Responsive
✅ Offline (localStorage, quota-safe)
✅ Accessibility (ARIA, focus mgmt)

🛠 Quick Start
# 1. Download 3 files (index.html, styles.css, app.js)
# 2. Double-click index.html
# 3. Add habits → Track → Export

🎯 Portfolio Highlights
• Glassmorphism UI (2026 trend) - CSS backdrop-filter
• Data Architecture - JSON schemas + normalization
• Responsive - CSS Grid/Flexbox mastery
• Performance - 60fps animations + virtual lists
• Accessibility - ARIA + keyboard + skip links
• State Management - Custom reducer pattern
• PWA Ready - Add sw.js for installable app

🧪 Tech Decisions
Storage: localStorage (try/catch quota handling)
CSS: Custom properties + Grid/Flexbox + Animations
JS: Vanilla ES6 (no frameworks - shows fundamentals)
State: Single source of truth + normalization
Build: Zero-build (production optimized)

📊 Key Algorithms
Streak Calculation: Consecutive scheduled days
Month Completion: (done/total) × 100
Best Streak: Max across all habits
Day Logging: O(1) habit toggle + bulk ops

📈 Usage Flow
1. Add "Workout 🏋️" (M/W/F, target:1, 19:00 reminder)
2. Click calendar dates → Toggle habits
3. View streaks/progress → Export CSV
4. Filter active/archived → Search
5. Toggle theme → Responsive anywhere

🔮 Scalability
Current: localStorage (single user, offline)
Next:    IndexedDB + ASP.NET API sync
Future:  Firebase Realtime + Push Notifications
Teams:   Shared habits + leaderboards

📱 Responsive Breakpoints
• Desktop: 2-column (habits + calendar)
• Tablet: Stacked panels
• Mobile: Single column + touch targets
