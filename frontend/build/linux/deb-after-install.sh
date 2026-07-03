#!/bin/bash
# Post-install script for the Semaphore Chat .deb (deb.afterInstall in
# electron-builder.yml) — issue #349.
#
# IMPORTANT: providing deb.afterInstall REPLACES electron-builder's default
# after-install.tpl, so this script must keep the default behavior (binary
# symlink, SUID chrome-sandbox, desktop/mime database refresh) in addition to
# the AppArmor handling.
#
# TEMPLATING: electron-builder substitutes dollar-brace macros (executable,
# sanitizedProductName, ...) at build time and FAILS the build on any unknown
# macro — never use dollar-brace syntax for shell variables in this file
# (not even in comments); write $var or "$var" instead.

# --- Default electron-builder behavior ---------------------------------------
# Keep in sync with app-builder-lib/templates/linux/after-install.tpl.

if type update-alternatives >/dev/null 2>&1; then
    # Remove previous link if it doesn't use update-alternatives
    if [ -L '/usr/bin/${executable}' -a -e '/usr/bin/${executable}' -a "`readlink '/usr/bin/${executable}'`" != '/etc/alternatives/${executable}' ]; then
        rm -f '/usr/bin/${executable}'
    fi
    update-alternatives --install '/usr/bin/${executable}' '${executable}' '/opt/${sanitizedProductName}/${executable}' 100 || ln -sf '/opt/${sanitizedProductName}/${executable}' '/usr/bin/${executable}'
else
    ln -sf '/opt/${sanitizedProductName}/${executable}' '/usr/bin/${executable}'
fi

# SUID chrome-sandbox for Electron 5+
chmod 4755 '/opt/${sanitizedProductName}/chrome-sandbox' || true

if hash update-mime-database 2>/dev/null; then
    update-mime-database /usr/share/mime || true
fi

if hash update-desktop-database 2>/dev/null; then
    update-desktop-database /usr/share/applications || true
fi

# --- AppArmor profile registration (#349) ------------------------------------
# Ubuntu 23.10+ sets kernel.apparmor_restrict_unprivileged_userns=1, which
# aborts Electron's sandbox unless an AppArmor profile grants the binary
# user-namespace creation. The profile ships as a conffile at
# /etc/apparmor.d/${executable} (see electron-builder.yml deb.fpm). Load it
# when AppArmor is active; silent no-op on systems without AppArmor, and
# tolerant of parse failures on AppArmor < 4 (which doesn't need it anyway).
APPARMOR_PROFILE='/etc/apparmor.d/${executable}'
if [ -f "$APPARMOR_PROFILE" ] \
    && command -v apparmor_parser >/dev/null 2>&1 \
    && [ -d /sys/kernel/security/apparmor ]; then
    apparmor_parser --replace --write-cache --skip-read-cache "$APPARMOR_PROFILE" >/dev/null 2>&1 || true
fi

exit 0
