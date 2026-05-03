# Deploy on Mac mini

1. `cp .env.example .env` and fill values; `bun run scripts/new-token.ts agent` to get the bearer.
2. `cp deploy/com.fitclaw.*.plist ~/Library/LaunchAgents/`
3. `launchctl load ~/Library/LaunchAgents/com.fitclaw.api.plist`
4. `launchctl load ~/Library/LaunchAgents/com.fitclaw.backup.plist`
5. Verify: `curl localhost:3000/healthz`
6. Tail logs: `tail -f data/api.log`
