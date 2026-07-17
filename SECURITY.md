# Security policy

## Project status

Model Relay Station is currently an early-stage project. Use it behind a trusted network boundary until you have reviewed its deployment configuration and applied your own hardening requirements.

## Reporting a vulnerability

Please do not open a public issue containing credentials, exploit details, or user data. Instead, use GitHub's private vulnerability reporting feature when it is enabled for this repository. If private reporting is unavailable, open a minimal issue that asks the maintainer for a private contact channel without disclosing the vulnerability.

Include:

- The affected commit or version.
- A concise reproduction.
- The expected and observed impact.
- Any suggested mitigation.

## Deployment checklist

- Set unique `ADMIN_PASSWORD` and `ADMIN_SESSION_SECRET` values.
- Keep `.env.local`, the SQLite database, upstream keys, and relay keys out of Git.
- Terminate TLS at a trusted reverse proxy.
- Restrict the admin console by network or an additional identity layer.
- Set request-size, rate, and timeout limits at the edge.
- Back up and protect the SQLite database.
- Rotate upstream and relay keys after any suspected exposure.
- Review logs before sharing them; they can contain sensitive metadata.
