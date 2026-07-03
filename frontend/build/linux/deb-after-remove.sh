#!/bin/bash
# Post-remove script for the Semaphore Chat .deb (deb.afterRemove in
# electron-builder.yml) — issue #349.
#
# IMPORTANT: providing deb.afterRemove REPLACES electron-builder's default
# after-remove.tpl, so this script must keep the default behavior (remove the
# /usr/bin symlink) in addition to the AppArmor cleanup.
#
# TEMPLATING: electron-builder substitutes dollar-brace macros (executable,
# ...) at build time and FAILS the build on any unknown macro — never use
# dollar-brace syntax for shell variables in this file (not even in
# comments); write $var or "$var" instead.

# --- Default electron-builder behavior ---------------------------------------
# Keep in sync with app-builder-lib/templates/linux/after-remove.tpl.
#
# DELIBERATE DEVIATION from upstream: update-alternatives --remove takes
# <name> <path> where <path> is the alternative registered by --install in
# deb-after-install.sh (/opt/${sanitizedProductName}/${executable}), NOT the
# /usr/bin link. Upstream's template passes the /usr/bin path, which
# update-alternatives rejects ("alternative not registered"), leaving the
# group and a dangling /usr/bin symlink behind.

# Delete the link to the binary
if type update-alternatives >/dev/null 2>&1; then
    update-alternatives --remove '${executable}' '/opt/${sanitizedProductName}/${executable}'
else
    rm -f '/usr/bin/${executable}'
fi

# --- AppArmor cleanup (#349) --------------------------------------------------
# dpkg removes /etc/apparmor.d/${executable} itself (it is a packaged
# conffile, kept until purge); we only unload the profile from the kernel.
# $1 is "remove"/"purge" on Debian removal and "upgrade" on package upgrade,
# where the new package's after-install reloads the profile, so we skip
# unloading. Silent no-op on systems without AppArmor.
case "$1" in
    remove|purge)
        if [ -w /sys/kernel/security/apparmor/.remove ]; then
            printf '%s' '${executable}' > /sys/kernel/security/apparmor/.remove 2>/dev/null || true
        fi
        ;;
esac

exit 0
