# Code Signing for Kraken Desktop App

This guide explains how to add proper code signing to eliminate security warnings when users install Kraken.

## Why Code Signing?

### Current Situation (Self-Signed)

- **Windows**: Users see "Windows protected your PC" SmartScreen warning
- **macOS**: Users must right-click → Open to bypass Gatekeeper
- **Linux**: No warnings (code signing less common)

### After Code Signing

- **Windows**: Silent installation, no warnings
- **macOS**: Double-click to install, no warnings
- **Better user trust**: Verified publisher identity
- **Required for**: Enterprise deployment, Microsoft Store, Mac App Store

## Cost Overview

| Method | Cost | Platform | Best For |
|--------|------|----------|----------|
| Self-Signed | **FREE** | All | Testing, internal use |
| Standard Certificate | **$75-400/year** | Windows | Small projects |
| EV Certificate | **$300-600/year** | Windows | Professional apps |
| Apple Developer | **$99/year** | macOS | Mac apps |
| SignPath.io | **FREE** (open source) | Windows | Open source projects |
| electron.build | **$99-299/year** | All | Easiest solution |

## Option 1: SignPath.io (Recommended for Open Source)

### Pros

- **FREE for open source projects**
- Cloud-based (no USB tokens)
- Works from any OS
- Integrates with CI/CD
- Certificate provided

### Setup Steps

1. **Sign up at** [signpath.io](https://signpath.io)

2. **Apply for free tier**:
   - Navigate to "Open Source" plan
   - Submit your GitHub repository
   - Approval takes 1-2 business days

3. **Create signing policy**:
   ```yaml
   # SignPath signing policy
   name: Kraken Windows Signing
   description: Sign Kraken desktop app

   certificate: OpenSource

   artifact-configuration:
     - type: PE
       deep-sign: true
   ```

4. **Get API credentials**:
   - Organization ID
   - Project Slug
   - Signing Policy Slug
   - API Token

5. **Configure electron-builder.yml**:

```yaml
win:
  target:
    - target: nsis
      arch:
        - x64
  sign: "./sign-with-signpath.js"
  signingHashAlgorithms:
    - sha256

# Custom signing script
beforeBuild: "scripts/setup-signing.js"
```

6. **Create signing script** (`frontend/sign-with-signpath.js`):

```javascript
const { SignPathClient } = require('@signpath/signpath-js');

module.exports = async function(configuration) {
  console.log('Signing with SignPath.io...');

  const client = new SignPathClient({
    organizationId: process.env.SIGNPATH_ORGANIZATION_ID,
    apiToken: process.env.SIGNPATH_API_TOKEN,
  });

  await client.submitSigningRequest({
    projectSlug: process.env.SIGNPATH_PROJECT_SLUG,
    signingPolicySlug: process.env.SIGNPATH_SIGNING_POLICY_SLUG,
    inputArtifactPath: configuration.path,
    outputArtifactPath: configuration.path,
  });

  console.log('Signing complete!');
};
```

7. **Set environment variables**:

```bash
export SIGNPATH_ORGANIZATION_ID=your-org-id
export SIGNPATH_PROJECT_SLUG=kraken
export SIGNPATH_SIGNING_POLICY_SLUG=release-signing
export SIGNPATH_API_TOKEN=your-token
```

8. **Build signed installer**:

```bash
cd frontend
npm run build:win
```

### GitHub Actions Integration

```yaml
- name: Sign and build Windows app
  env:
    SIGNPATH_ORGANIZATION_ID: ${{ secrets.SIGNPATH_ORG_ID }}
    SIGNPATH_API_TOKEN: ${{ secrets.SIGNPATH_TOKEN }}
    SIGNPATH_PROJECT_SLUG: kraken
    SIGNPATH_SIGNING_POLICY_SLUG: release-signing
  run: |
    cd frontend
    npm run build:win
```

## Option 2: electron.build Service (Easiest, Paid)

### Pros

- Dead simple setup
- Works for all platforms
- Manages certificates for you
- Cloud-based

### Setup Steps

1. **Sign up at** [electron.build](https://electron.build)

2. **Choose plan**:
   - Standard: $99/year (Windows)
   - Professional: $299/year (Windows + macOS)

3. **Get API key** from dashboard

4. **Configure electron-builder.yml**:

```yaml
win:
  sign: {
    "provider": "electronbuild",
    "apiKey": "${env.ELECTRON_BUILD_API_KEY}"
  }
```

5. **Set API key**:

```bash
export ELECTRON_BUILD_API_KEY=your-api-key
```

6. **Build**:

```bash
npm run build:win
```

Done! Installer is automatically signed.

## Option 3: Traditional Code Signing Certificate

### Windows - Standard Certificate

**Requirements**:
- Windows machine for signing (or VM)
- Organization validation
- $75-400/year

**Certificate Providers**:
- DigiCert: $400/year
- Sectigo (Comodo): $150/year
- GoDaddy: $75/year
- SSL.com: $100/year

**Purchase Process**:

1. **Buy certificate** from provider

2. **Organization validation** (2-5 days):
   - Prove you own the domain/company
   - Phone verification
   - Business documentation

3. **Receive certificate**:
   - `.pfx` or `.p12` file
   - Password protected

4. **Configure electron-builder.yml**:

```yaml
win:
  certificateFile: "./certs/certificate.pfx"
  certificatePassword: "${env.WINDOWS_CERT_PASSWORD}"
  signingHashAlgorithms:
    - sha256
  sign: null  # Use default Windows signing
```

5. **Set password**:

```bash
export WINDOWS_CERT_PASSWORD=your-cert-password
```

6. **Build**:

```bash
npm run build:win
```

**Security**:
- **Never commit** `.pfx` file to git
- Store in secure location
- Use environment variable for password
- Consider hardware security module (HSM)

### Windows - EV Certificate (Extended Validation)

**Benefits**:
- Instant SmartScreen reputation
- No warnings from day one
- Better trust indicators

**Requirements**:
- $300-600/year
- **Physical USB token** (YubiKey-like device)
- Must sign on Windows machine with USB plugged in
- Organization validation (stricter than standard)

**Limitation**:
- **Cannot sign in CI/CD** (requires physical USB)
- Must sign on local Windows machine

**Setup**:

1. Purchase EV certificate from provider

2. Receive USB token by mail (3-5 days)

3. Install certificate on Windows machine

4. Sign builds manually:

```bash
# On Windows machine with USB plugged in
cd frontend
npm run build:win
```

### macOS - Apple Developer Account

**Requirements**:
- macOS machine (or VM)
- $99/year
- Apple Developer account

**Setup Steps**:

1. **Sign up**: [developer.apple.com](https://developer.apple.com)

2. **Enroll in Developer Program** ($99/year)

3. **Install Xcode** from Mac App Store

4. **Create signing certificate**:
   - Open Xcode
   - Preferences → Accounts
   - Add Apple ID
   - Manage Certificates → Create "Developer ID Application"

5. **Configure electron-builder.yml**:

```yaml
mac:
  category: public.app-category.social-networking
  hardenedRuntime: true
  gatekeeperAssess: false
  entitlements: "build/entitlements.mac.plist"
  entitlementsInherit: "build/entitlements.mac.plist"
  identity: "Developer ID Application: Your Name (TEAM_ID)"
```

6. **Create entitlements file** (`frontend/build/entitlements.mac.plist`):

```xml
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
  <key>com.apple.security.cs.allow-unsigned-executable-memory</key>
  <true/>
  <key>com.apple.security.cs.allow-jit</key>
  <true/>
</dict>
</plist>
```

7. **Build and sign**:

```bash
cd frontend
npm run build:mac
```

8. **Notarize** (required for macOS 10.15+):

```bash
# After building
xcrun notarytool submit frontend/release/*.dmg \
  --apple-id your-apple-id@example.com \
  --password your-app-specific-password \
  --team-id YOUR_TEAM_ID \
  --wait
```

**Notarization**:
- Required for distribution outside Mac App Store
- Takes 5-60 minutes
- Uses app-specific password (not Apple ID password)
- Can be automated in CI/CD

## Comparison Matrix

| Feature | SignPath.io | electron.build | Traditional | EV Cert |
|---------|-------------|----------------|-------------|---------|
| **Cost (Open Source)** | FREE | $99/year | $75-400/year | $300-600/year |
| **Platform** | Windows | All | All | Windows |
| **CI/CD** | ✅ Yes | ✅ Yes | ⚠️ Depends | ❌ No (USB required) |
| **Setup Difficulty** | Medium | Easy | Hard | Hard |
| **Instant Trust** | ⚠️ Builds reputation | ⚠️ Builds reputation | ⚠️ Builds reputation | ✅ Immediate |
| **Certificate Mgmt** | Handled | Handled | You manage | You manage |

## SmartScreen Reputation

Even with code signing, new applications must build reputation:

- **Weeks 1-2**: May show warnings despite signing
- **After ~100-1000 downloads**: Warnings decrease
- **With EV certificate**: Instant reputation

## Testing Signed Builds

1. Build and sign installer

2. Upload to GitHub Release

3. Download on fresh Windows machine

4. Run installer - should see:
   - Publisher name (not "Unknown publisher")
   - No SmartScreen warning (if EV cert)
   - Or "Run anyway" needed once (standard cert)

## Automation with GitHub Actions

```yaml
name: Build and Sign

on:
  push:
    tags:
      - 'v*'

jobs:
  build-windows:
    runs-on: windows-latest
    steps:
      - uses: actions/checkout@v3

      - name: Setup Node.js
        uses: actions/setup-node@v3
        with:
          node-version: '18'

      - name: Install dependencies
        run: |
          cd frontend
          npm install

      - name: Build and sign
        env:
          # For SignPath.io
          SIGNPATH_ORGANIZATION_ID: ${{ secrets.SIGNPATH_ORG_ID }}
          SIGNPATH_API_TOKEN: ${{ secrets.SIGNPATH_TOKEN }}

          # For traditional cert
          WINDOWS_CERT_PASSWORD: ${{ secrets.CERT_PASSWORD }}
          WINDOWS_CERT_FILE: ${{ secrets.CERT_BASE64 }}
        run: |
          cd frontend
          # Decode certificate if using traditional method
          echo "$WINDOWS_CERT_FILE" | base64 -d > cert.pfx
          npm run build:win

      - name: Upload artifacts
        uses: actions/upload-artifact@v3
        with:
          name: windows-installer
          path: frontend/release/*.exe
```

## Recommendations

### For Open Source Projects

**Use SignPath.io**:
- FREE
- Professional appearance
- Easy CI/CD integration

### For Commercial Projects (Small)

**Use electron.build**:
- Easiest setup
- All platforms
- Worth the $99-299/year

### For Commercial Projects (Established)

**Traditional EV Certificate**:
- Instant reputation
- Complete control
- Professional appearance

### For Internal/Testing

**Self-Signed**:
- FREE
- Good enough for internal use
- Users know to click "Run anyway"

## Security Best Practices

1. **Never commit certificates** to git
2. **Use environment variables** for passwords
3. **Rotate certificates** before expiry
4. **Store backups** securely (encrypted)
5. **Use hardware security** for EV certs
6. **Monitor certificate** expiration dates
7. **Test signing** in staging environment

## Troubleshooting

### "Certificate not found"

Check:
- Certificate file path is correct
- Environment variable is set
- Certificate hasn't expired

### "Wrong password"

- Double-check WINDOWS_CERT_PASSWORD
- Ensure no trailing spaces
- Try password without quotes

### Signing Fails in CI/CD

- Verify secrets are set in GitHub Settings
- Check certificate is base64 encoded correctly
- Review CI/CD logs for specific error

### Users Still See Warnings

- Ensure certificate is code signing cert (not SSL)
- Verify installer is actually signed: Right-click → Properties → Digital Signatures
- Build SmartScreen reputation (takes time)
- Consider EV certificate for instant trust

## Next Steps

1. Choose signing method based on project needs
2. Set up signing locally
3. Test signed builds
4. Integrate with CI/CD
5. Monitor user feedback

## References

- [electron-builder Code Signing](https://www.electron.build/code-signing)
- [SignPath.io Documentation](https://signpath.io/documentation)
- [Microsoft Code Signing Guide](https://docs.microsoft.com/en-us/windows/win32/seccrypto/cryptography-tools)
- [Apple Code Signing Guide](https://developer.apple.com/documentation/security/notarizing_macos_software_before_distribution)
