# Security

## Reporting vulnerabilities

Report security issues via [GitHub private vulnerability reporting](https://github.com/krakenchat/kraken/security/advisories/new). Include a description, steps to reproduce, and potential impact. Only maintainers can see the report until a fix is released.

## Self-hosting checklist

- [ ] Change all default JWT secrets — generate with `openssl rand -base64 32`
- [ ] Use HTTPS with valid TLS certificates
- [ ] Restrict network access to MongoDB and Redis (don't expose ports publicly)
- [ ] Enable authentication on all database connections
- [ ] Keep images updated — watch for [Dependabot alerts](https://github.com/krakenchat/kraken/security/dependabot)
- [ ] Back up MongoDB regularly
