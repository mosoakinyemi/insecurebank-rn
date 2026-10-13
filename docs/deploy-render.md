# Optional Render + Aiven playground

Run the workshop locally by default. Use this guide if you want attendees to share one hosted API for account creation and corrected-mode practice. Keep vulnerable BOLA exercises on a local or isolated API.

## What this deploys

- One public Express API web service on Render's Free plan, with HTTPS.
- One Aiven MySQL Free service (1 GB storage) for hosted accounts and transactions.
- Corrected authorization in production and no public database-reset route.
- Synthetic data only. Registration is open and has no email verification; share the API URL only with workshop participants.

Local runs continue to use SQLite. The hosted service selects MySQL when `MYSQL_URL` exists and requires `MYSQL_SSL_CA` to verify the database certificate. These are server-side values; never place them in the mobile `.env` or app bundle.

## Free-tier behavior

Aiven's MySQL Free tier currently has no fixed expiration date. It includes 1 GB storage, backups, and one service node. Aiven may power off a free service that sees no continued activity; it notifies you, and you can start the service again. Monitor the Aiven dashboard and email notices. The free tier has no SLA and is not intended for production. See [Aiven's free MySQL limits](https://aiven.io/docs/products/mysql/concepts/mysql-free-tier).

Render's Free API service spins down after 15 minutes without inbound traffic. Its next request can take about a minute to start. It uses an outbound connection to Aiven, so keep this as a small workshop demo. See [Render's free service limits](https://render.com/docs/free).

## Prepare Aiven

1. Create an Aiven account and an **Aiven for MySQL** Free service. The Free plan does not let you select a specific cloud or region.
2. Wait for the service to become available, then open its connection information in Aiven.
3. Copy its MySQL service URI. It includes the hostname, port, username, password, and database name; keep it private.
4. Download the Aiven project CA certificate. Render will use it to validate the MySQL server certificate.

Aiven's MySQL service URI includes TLS mode. The API separately requires the CA certificate and validates it; if the certificate is omitted, the API refuses to start with MySQL.

## Deploy on Render

1. Push the project to a Git provider connected to your Render account. The current local project has no Git remote, so Render cannot deploy it until you push/connect a repository.
2. In Render, create a Blueprint and connect the repository.
3. Review `render.yaml`. Its build command explicitly includes development dependencies so TypeScript and type declarations are available during compilation, even when `NODE_ENV=production`. It configures one Free API web service and prompts for `MYSQL_URL` and `MYSQL_SSL_CA`; provide the Aiven service URI and the contents of the downloaded PEM CA certificate. These are server-side Render environment variables, never mobile settings.
4. Apply the Blueprint and wait for deployment. Open `https://YOUR-SERVICE.onrender.com/health`; it should return `{"status":"ok","lab":"InsecureBank RN"}`.
5. Set the API URL in the mobile app's local `.env`:

   ```dotenv
   LAB_API_BASE_URL=https://YOUR-SERVICE.onrender.com
   ```

6. Restart Metro, rebuild/reinstall the training APK, and create a fresh synthetic account.

## Operations

- Keep the deployment on one API instance and use synthetic workshop data only.
- Do not set `AUTHZ_MODE=vulnerable`, enable public reset, or use real user or financial data.
- Monitor Aiven for idle-service notifications and restarts; Render's first request after sleep may be slow.
- Turn off or delete the services when you no longer need the shared playground.

For current details, see Aiven's [Free MySQL limits](https://aiven.io/docs/products/mysql/concepts/mysql-free-tier), [MySQL TLS guidance](https://aiven.io/docs/platform/concepts/tls-ssl-certificates), and Render's [free service limits](https://render.com/docs/free) and [Blueprint reference](https://render.com/docs/blueprint-spec).
