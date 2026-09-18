import ipaddress
import re
from urllib.parse import urlparse

# Private and internal IP ranges to block against SSRF
PRIVATE_NETWORKS = [
    ipaddress.ip_network("127.0.0.0/8"),
    ipaddress.ip_network("10.0.0.0/8"),
    ipaddress.ip_network("172.16.0.0/12"),
    ipaddress.ip_network("192.168.0.0/16"),
    ipaddress.ip_network("169.254.0.0/16"),
    ipaddress.ip_network("0.0.0.0/8"),
    ipaddress.ip_network("::1/128"),
    ipaddress.ip_network("fc00::/7"),
    ipaddress.ip_network("fe80::/10"),
]

BLOCKED_HOSTNAMES = {
    "localhost",
    "localhost.localdomain",
    "loopback",
}

def is_safe_url(url: str) -> tuple[bool, str]:
    """
    Validates that a URL is safe to fetch (protects against SSRF, internal network access, invalid schemes).
    Returns (is_safe, error_message).
    """
    if not url or not isinstance(url, str):
        return False, "URL invalide ou vide."

    url = url.strip()

    # Magnet links are allowed for torrents
    if url.startswith("magnet:?"):
        return True, ""

    try:
        parsed = urlparse(url)
    except Exception:
        return False, "URL impossible à analyser."

    if parsed.scheme not in ("http", "https"):
        return False, f"Protocole non supporté: {parsed.scheme}. Seuls HTTP et HTTPS sont autorisés."

    hostname = parsed.hostname
    if not hostname:
        return False, "Nom d'hôte manquant dans l'URL."

    hostname_lower = hostname.lower()
    if hostname_lower in BLOCKED_HOSTNAMES:
        return False, "Accès aux hôtes locaux non autorisé."

    # Check if host is an IP address
    try:
        ip = ipaddress.ip_address(hostname_lower)
        for net in PRIVATE_NETWORKS:
            if ip in net:
                return False, "Accès aux adresses IP privées/locales non autorisé."
    except ValueError:
        # Hostname is a domain name, not a direct IP string
        pass

    return True, ""

def sanitize_filename(filename: str, max_length: int = 255) -> str:
    """
    Sanitizes a filename to avoid Path Traversal and illegal characters.
    """
    if not filename:
        filename = "download"
    # Remove path components
    filename = filename.replace("\\", "/").split("/")[-1]
    # Remove dangerous/illegal characters
    filename = re.sub(r'[^\w\s\.\-\(\)\[\]]', '_', filename)
    # Strip leading/trailing dots or spaces
    filename = filename.strip(". ")
    if not filename:
        filename = "file"
    return filename[:max_length]
