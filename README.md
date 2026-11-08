# Express Courier World

Courier website with shipment tracking, quote requests, booking enquiries, customer support links, and a staff portal.

## Run locally

Requires Node.js 20 or newer.

1. Install dependencies: `npm install`
2. Copy `.env.example` to `.env` and set the values described below.
3. Start the server: `npm start`
4. Visit `http://localhost:3000` (staff portal: `/admin.html`).

`npm start` first prepares the generated `public/` directory from the website files in the repository root, then starts the Express server. The generated folder, local environment file, and SQLite database are intentionally ignored by Git.

Run `npm run check` to check JavaScript syntax.

## Admin account and security

Set `ADMIN_EMAIL` and `ADMIN_PASSWORD_HASH` in `.env` or your hosting provider's environment settings. The admin password is stored as a bcrypt hash, never as plaintext. Generate a hash locally after installing dependencies:

```bash
node -e "const readline=require('node:readline/promises');const bcrypt=require('bcryptjs');(async()=>{const rl=readline.createInterface({input:process.stdin,output:process.stdout});const password=await rl.question('New admin password: ');rl.close();console.log(await bcrypt.hash(password,12));})();"
```

Paste the resulting hash into `ADMIN_PASSWORD_HASH`. Use a new, unique password: the password previously shared in chat should be considered compromised and must not be used. Do not commit `.env` or share its contents.

Set `SESSION_SECRET` to a random secret of at least 32 characters. For example, generate one with `node -e "console.log(require('crypto').randomBytes(48).toString('hex'))"`. Configure these same secrets in the hosting provider if deploying. Set `ADMIN_EMAIL=paulermicheals@gmail.com` there if that is the intended staff account.

## Optional email notifications

Enquiries are saved to the local SQLite database. To forward notifications by email, configure `SMTP_HOST`, `SMTP_PORT`, `SMTP_SECURE`, `SMTP_USER`, `SMTP_PASS`, `MAIL_FROM`, and `SUPPORT_EMAIL` in the environment.

## Deployment

Deploy this as a Node.js web service with Node.js 20+, run `npm install` during build and `npm start` to launch. Configure secrets and persistent storage for the SQLite database on the host. A public domain/production deployment is not configured by this repository alone; configure your hosting provider and domain separately. The app listens on `PORT` (default `3000`).
