# ML HUB BOT

A comprehensive Discord bot for Mobile Legends Bang Bang community management with ticket system, match result submissions, and tournament features.

## Features

- 🎫 **Ticket System** - Create complaints, suggestions, and support tickets
- 🪙 **Coin Toss** - Decide first pick for tournaments
- 🎮 **Match Submissions** - Submit match results with screenshots
- 📊 **Admin Dashboard** - View statistics and manage data
- 🔥 **Firebase Integration** - Cloud-based data storage

## Commands

### Ticket Commands
- `/ticket create` - Create a new ticket (complaint, suggestion, or support)
- `/ticket list` - List your open tickets
- `/ticket close` - Close a ticket
- `/ticket panel` - Create ticket panel (Admin only)

### Match Commands
- `/match submit` - Submit match results with screenshots
- `/match verify` - Verify a match submission (Admin/Mod)
- `/match reject` - Reject a match submission (Admin/Mod)
- `/match view` - View match details

### Other Commands
- `/cointoss` - Toss a coin to decide first pick
- `/admin stats` - View bot statistics (Admin only)
- `/admin cleanup` - Clean up old data (Admin only)

## Deployment

This bot is deployed on Render.com and uses Firebase Firestore for data storage.

### Environment Variables Required
- `DISCORD_TOKEN` - Your Discord bot token
- `CLIENT_ID` - Discord application ID
- `GUILD_ID` - Discord server ID
- `FIREBASE_PROJECT_ID` - Firebase project ID
- `FIREBASE_PRIVATE_KEY` - Firebase private key
- `FIREBASE_CLIENT_EMAIL` - Firebase client email
- Channel and role IDs for your server

## Author

**Hendrix-D-Dev**

## License

MIT