# Security Policy

## Supported versions

| Version | Supported |
|---------|-----------|
| 1.x.x | Yes |
| < 1.0 | No |

## Reporting a vulnerability

We take security seriously. If you discover a security vulnerability, please report it responsibly.

!!! danger "Do NOT open a public GitHub issue for security vulnerabilities."

### How to report

1. **Email**: Send details to **security@krakenchat.app**
2. **GitHub Security Advisories**: Use [GitHub's private vulnerability reporting](https://github.com/krakenchat/kraken/security/advisories/new)

### What to include

- Description of the vulnerability
- Steps to reproduce
- Potential impact
- Suggested fixes (optional)

### What to expect

- **Acknowledgment**: Within 48 hours
- **Initial assessment**: Within 1 week
- **Resolution timeline**: Depends on severity, typically 30–90 days

## Scope

### In scope

- Kraken backend API
- Kraken frontend application
- Electron desktop application
- Docker images and Helm charts
- Authentication and authorization flaws
- Data exposure vulnerabilities

### Out of scope

- Self-hosted instances with modified code
- Third-party dependencies (report to upstream maintainers)
- Social engineering attacks
- Physical security

## Self-hosting security best practices

If you're self-hosting Kraken:

1. **Change all default secrets** in your `.env` and Helm values
2. **Use HTTPS** with valid TLS certificates
3. **Keep dependencies updated** — watch for Dependabot alerts
4. **Restrict network access** to your MongoDB and Redis instances
5. **Enable authentication** on all database connections
6. **Regularly backup** your data
7. **Monitor logs** for suspicious activity

## Acknowledgments

We appreciate security researchers who help keep Kraken safe. Contributors who responsibly disclose vulnerabilities will be acknowledged here (with permission).
