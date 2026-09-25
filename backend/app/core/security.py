import re
import socket
import ipaddress
from urllib.parse import urlparse
from pathlib import Path
from fastapi import HTTPException
from app.core.config import settings

# Disallowed IP networks for SSRF protection
BLOCKED_NETWORKS = [
    ipaddress.ip_network("127.0.0.0/8"),       # Loopback
    ipaddress.ip_network("10.0.0.0/8"),        # Private network
    ipaddress.ip_network("172.16.0.0/12"),     # Private network
    ipaddress.ip_network("192.168.0.0/16"),    # Private network
    ipaddress.ip_network("169.254.0.0/16"),    # Link-local
    ipaddress.ip_network("0.0.0.0/8"),         # Current network
    ipaddress.ip_network("100.64.0.0/10"),     # Carrier-grade NAT
    ipaddress.ip_network("192.0.0.0/24"),      # IETF Protocol Assignments
    ipaddress.ip_network("192.0.2.0/24"),      # TEST-NET-1
    ipaddress.ip_network("198.18.0.0/15"),     # Benchmarking
    ipaddress.ip_network("198.51.100.0/24"),   # TEST-NET-2
    ipaddress.ip_network("203.0.113.0/24"),    # TEST-NET-3
    ipaddress.ip_network("224.0.0.0/4"),       # Multicast
    ipaddress.ip_network("240.0.0.0/4"),       # Reserved
    ipaddress.ip_network("::1/128"),           # IPv6 Loopback
    ipaddress.ip_network("fc00::/7"),          # IPv6 Unique Local Address
    ipaddress.ip_network("fe80::/10"),         # IPv6 Link-Local Address
    ipaddress.ip_network("::ffff:0:0/96"),     # IPv4-mapped IPv6
]

WINDOWS_RESERVED_NAMES = {
    "CON", "PRN", "AUX", "NUL",
    *(f"COM{i}" for i in range(1, 10)),
    *(f"LPT{i}" for i in range(1, 10)),
}


def is_ip_blocked(ip_str: str) -> bool:
    """Check if an IP address falls within any private or prohibited network range."""
    try:
        ip_obj = ipaddress.ip_address(ip_str)
        # Check standard properties
        if ip_obj.is_private or ip_obj.is_loopback or ip_obj.is_link_local or ip_obj.is_reserved or ip_obj.is_multicast:
            return True
        for net in BLOCKED_NETWORKS:
            if ip_obj in net:
                return True
        return False
    except ValueError:
        return True


def validate_url_security(url: str, allow_magnet: bool = False) -> str:
    """
    Validates that a URL is well-formed, uses allowed scheme,
    and does not point to internal/loopback/private IP addresses (SSRF defense).
    """
    if not url or not isinstance(url, str):
        raise HTTPException(status_code=400, detail="URL invalide ou vide.")

    cleaned_url = url.strip()

    # Magnet links for torrents
    if cleaned_url.startswith("magnet:?"):
        if not allow_magnet:
            raise HTTPException(status_code=400, detail="Les liens magnet sont uniquement acceptés dans le Torrent Center.")
        return cleaned_url

    parsed = urlparse(cleaned_url)
    if parsed.scheme not in ("http", "https"):
        raise HTTPException(
            status_code=400,
            detail=f"Protocole '{parsed.scheme}' non supporté. Seuls HTTP et HTTPS sont autorisés."
        )

    hostname = parsed.hostname
    if not hostname:
        raise HTTPException(status_code=400, detail="Nom d'hôte manquant dans l'URL.")

    # Check for direct loopback names
    lowered_host = hostname.lower()
    if lowered_host in ("localhost", "0.0.0.0") or lowered_host.endswith((".local", ".internal", ".localhost")):
        raise HTTPException(status_code=400, detail="Accès aux réseaux locaux et hôtes internes bloqué.")

    # Check direct IP addresses or resolve DNS
    try:
        addr_info = socket.getaddrinfo(hostname, None, socket.AF_UNSPEC, socket.SOCK_STREAM)
        for entry in addr_info:
            sockaddr = entry[4]
            ip_str = sockaddr[0]
            if is_ip_blocked(ip_str):
                raise HTTPException(
                    status_code=403,
                    detail=f"Sécurité anti-SSRF : L'adresse IP résolue ({ip_str}) est privée ou interdite."
                )
    except socket.gaierror:
        # DNS resolution failure
        raise HTTPException(status_code=400, detail=f"Impossible de résoudre le nom de domaine '{hostname}'.")

    return cleaned_url


def sanitize_filename(filename: str, default_name: str = "downloaded_media") -> str:
    """
    Sanitizes filenames to prevent Path Traversal, null bytes,
    and Windows forbidden characters or reserved filenames.
    """
    if not filename:
        return default_name

    # Remove path delimiters and control characters
    cleaned = filename.replace("\\", "/").split("/")[-1]
    cleaned = re.sub(r'[\x00-\x1f\x7f]', '', cleaned)
    # Strip Windows invalid filename characters: < > : " / \ | ? *
    cleaned = re.sub(r'[<>:"/\\|?*]', '_', cleaned)
    cleaned = cleaned.strip().strip(". ")

    # Check Windows reserved base names
    stem = Path(cleaned).stem.upper()
    if stem in WINDOWS_RESERVED_NAMES or not cleaned:
        cleaned = f"safe_{cleaned or default_name}"

    # Truncate length
    if len(cleaned) > 200:
        ext = Path(cleaned).suffix[:10]
        cleaned = cleaned[: 190 - len(ext)] + ext

    return cleaned or default_name


def safe_join_path(base_dir: Path, target_filename: str) -> Path:
    """
    Safely joins a base directory with a sanitized target filename,
    guaranteeing it stays strictly inside the base directory.
    """
    sanitized = sanitize_filename(target_filename)
    dest_path = (base_dir / sanitized).resolve()
    base_resolved = base_dir.resolve()
    if not str(dest_path).startswith(str(base_resolved)):
        raise HTTPException(status_code=400, detail="Tentative de traversée de chemin (path traversal) détectée.")
    return dest_path
