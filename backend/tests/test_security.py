import pytest
from fastapi import HTTPException
from app.core.security import validate_url_security, sanitize_filename, is_ip_blocked


def test_ip_blocked():
    assert is_ip_blocked("127.0.0.1") is True
    assert is_ip_blocked("10.0.0.1") is True
    assert is_ip_blocked("192.168.1.1") is True
    assert is_ip_blocked("172.16.0.5") is True
    assert is_ip_blocked("169.254.1.1") is True
    assert is_ip_blocked("::1") is True
    # Public IP
    assert is_ip_blocked("8.8.8.8") is False
    assert is_ip_blocked("1.1.1.1") is False


def test_validate_url_security_valid():
    url = "https://www.example.com/test.mp4"
    assert validate_url_security(url) == url


def test_validate_url_security_rejects_localhost():
    with pytest.raises(HTTPException) as exc:
        validate_url_security("http://localhost:8080/secret")
    assert exc.value.status_code == 400


def test_validate_url_security_rejects_private_ip():
    with pytest.raises(HTTPException) as exc:
        validate_url_security("http://192.168.1.50/admin")
    assert exc.value.status_code in (400, 403)


def test_sanitize_filename():
    assert sanitize_filename("../../../etc/passwd") == "passwd"
    assert sanitize_filename("my?cool:video*.mp4") == "my_cool_video_.mp4"
    assert sanitize_filename("CON.mp4") == "safe_CON.mp4"
    assert sanitize_filename("NUL") == "safe_NUL"
